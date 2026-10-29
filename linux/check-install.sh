#!/usr/bin/env bash
# Checks the Linux release archive on a machine with systemd, as root: installs
# it, checks the service answers with the archive's version, updates it and
# checks the settings were kept, then uninstalls it. Given an archive from
# before the rename to den-watcher, it first installs that one and checks the
# new archive takes it over with its settings, add-ons and history.
#
#   sudo linux/check-install.sh den-watcher-1.2.3-linux-amd64.tar.gz 1.2.3 [usage-control-2.0.7a-linux-amd64.tar.gz]
set -euo pipefail

archive="$(realpath "$1")"
version="$2"
old_archive="${3:+$(realpath "$3")}"
work="$(mktemp -d)"
docker_check=false

# Removes the test container of the containers add-on and its image, where
# they are.
remove_check() {
  docker rm -f den-watcher-check > /dev/null 2>&1 || true
  docker rmi den-watcher-check > /dev/null 2>&1 || true
}

trap 'if [[ "$docker_check" == true ]]; then remove_check; fi; rm -rf "$work"' EXIT
# A failing step shows what the services logged.
trap 'journalctl -u "den-watcher*" --no-pager | tail -40 >&2' ERR
tar -xzf "$archive" -C "$work"
folder="$(find "$work" -mindepth 1 -maxdepth 1 -type d)"

# Waits until the service answers at path and prints the answer.
answer() {
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:9393$1" 2> /dev/null; then
      return 0
    fi
    sleep 1
  done
  journalctl -u den-watcher --no-pager | tail -40 >&2
  echo "den-watcher did not answer $1" >&2
  return 1
}

# Checks the add-on $1 runs and writes its report to the add-on folder within
# 10 seconds, holding $2 when it is given; otherwise fails, saying $3.
addon_reports() {
  local report="/run/den-watcher-addons/$1.json"
  systemctl is-active --quiet "den-watcher-$1" || { journalctl -u "den-watcher-$1" --no-pager | tail -20 >&2; echo "the $1 add-on is not running" >&2; exit 1; }
  for _ in $(seq 1 10); do
    [[ -f "$report" ]] && { [[ -z "$2" ]] || grep -qs -- "$2" "$report"; } && return
    sleep 1
  done
  echo "$3" >&2
  exit 1
}

# Whether the unit $1 or its program in /usr/local/bin is still there.
installed() { systemctl cat "$1" > /dev/null 2>&1 || [[ -e "/usr/local/bin/$1" ]]; }

if [[ -n "$old_archive" ]]; then
  old="$work/old"
  mkdir "$old"
  tar -xzf "$old_archive" -C "$old"
  old_folder="$(find "$old" -mindepth 1 -maxdepth 1 -type d)"
  "$old_folder/install.sh" --addons=power < /dev/null
  sed -i 's/^DEVICE_NAME=.*/DEVICE_NAME=Before the rename/' /etc/usage-control.env
  systemctl restart usage-control
  answer /api/devices | grep -q '"name":"Before the rename"' || { echo "the old archive did not take DEVICE_NAME" >&2; exit 1; }
  test -f /var/lib/usage-control/usage-control.db
  # A mistyped option stops before the move, and the old install keeps running.
  if "$folder/install.sh" --addons=nosuch < /dev/null; then
    echo "install.sh took an add-on that does not exist" >&2
    exit 1
  fi
  systemctl is-active --quiet usage-control || { echo "a mistyped option stopped usage-control" >&2; exit 1; }
  # Without --addons and without a terminal, as an unattended update.
  "$folder/install.sh" < /dev/null
  answer /api/metrics | grep -q "\"version\":\"$version\"" || { echo "the service does not report version $version after the move" >&2; exit 1; }
  answer /api/devices | grep -q '"name":"Before the rename"' || { echo "the move lost DEVICE_NAME" >&2; exit 1; }
  test -f /var/lib/den-watcher/usage-control.db || { echo "the move lost the history" >&2; exit 1; }
  systemctl is-active --quiet den-watcher-power || { echo "the move lost the power add-on" >&2; exit 1; }
  if systemctl cat usage-control > /dev/null 2>&1 || systemctl cat usage-control-power > /dev/null 2>&1 ||
    compgen -G '/usr/local/bin/usage-control*' > /dev/null || [[ -e /etc/usage-control.env || -e /var/lib/usage-control || -e /var/lib/private/usage-control ]]; then
    echo "the move left usage-control behind" >&2
    exit 1
  fi
  # An install removed with the old --uninstall kept its settings and
  # history, which move too.
  "$folder/install.sh" --uninstall --purge
  "$old_folder/install.sh" --addons= < /dev/null
  sed -i 's/^DEVICE_NAME=.*/DEVICE_NAME=Uninstalled before the rename/' /etc/usage-control.env
  systemctl restart usage-control
  answer /api/devices | grep -q '"name":"Uninstalled before the rename"' || { echo "the old archive did not take DEVICE_NAME" >&2; exit 1; }
  "$old_folder/install.sh" --uninstall
  "$folder/install.sh" --addons= < /dev/null
  answer /api/devices | grep -q '"name":"Uninstalled before the rename"' || { echo "the move after the old --uninstall lost DEVICE_NAME" >&2; exit 1; }
  test -f /var/lib/den-watcher/usage-control.db || { echo "the move after the old --uninstall lost the history" >&2; exit 1; }
  if [[ -e /etc/usage-control.env || -e /var/lib/usage-control || -e /var/lib/private/usage-control ]]; then
    echo "the move after the old --uninstall left usage-control behind" >&2
    exit 1
  fi
  sed -i 's/^DEVICE_NAME=.*/DEVICE_NAME=/' /etc/den-watcher.env
fi

"$folder/install.sh"
answer /api/metrics | grep -q "\"version\":\"$version\"" || { echo "the service does not report version $version" >&2; exit 1; }
systemctl is-enabled --quiet den-watcher

# An update keeps the settings and the history.
sed -i 's/^DEVICE_NAME=.*/DEVICE_NAME=Install check/' /etc/den-watcher.env
"$folder/install.sh"
answer /api/devices | grep -q '"name":"Install check"' || { echo "the update lost DEVICE_NAME" >&2; exit 1; }
test -f /var/lib/den-watcher/usage-control.db

# The power add-on runs as a service of its own and writes to the add-on
# folder; an update without --addons keeps it.
"$folder/install.sh" --addons=power
addon_reports power "" "the power add-on wrote no report"

# The containers add-on reports a running container by its name, which it
# reads from Docker's settings, where the runner has Docker.
"$folder/install.sh" --addons=power,containers
systemctl is-active --quiet den-watcher-containers || { journalctl -u den-watcher-containers --no-pager | tail -20 >&2; echo "the containers add-on is not running" >&2; exit 1; }
# It takes DOCKER_DIR from the settings file, like den-watcher.
systemctl show -p EnvironmentFiles den-watcher-containers | grep -q /etc/den-watcher.env || { echo "the containers add-on does not read /etc/den-watcher.env" >&2; exit 1; }
if command -v docker > /dev/null && docker info > /dev/null 2>&1 && [[ -f /sys/fs/cgroup/cgroup.controllers ]]; then
  # A container of den-watcher itself, from the archive, so nothing is
  # pulled from a registry.
  # The container and image go also when a step fails; one left by an
  # earlier run that stopped halfway goes first, so the name is free.
  docker_check=true
  remove_check
  tar -C "$folder" -c den-watcher | docker import --change 'ENTRYPOINT ["/den-watcher"]' - den-watcher-check > /dev/null
  # Without --rm, so a container that exited early is still there to show.
  docker run -d --name den-watcher-check --network none -e UPDATE_CHECK=false den-watcher-check > /dev/null
  # Kept before the container goes: a report written after that no longer
  # has it.
  reported=false
  for _ in $(seq 1 30); do
    if grep -q '"label":"den-watcher-check"' /run/den-watcher-addons/containers.json 2> /dev/null; then
      reported=true
      break
    fi
    sleep 1
  done
  if [[ "$reported" != true ]]; then
    # What the add-on had to go on, shown before the container goes.
    {
      echo "--- the container"
      docker ps -a --no-trunc --filter name=den-watcher-check || true
      docker inspect -f 'id={{.Id}} status={{.State.Status}} exit={{.State.ExitCode}} pid={{.State.Pid}}' den-watcher-check || true
      docker logs --tail 20 den-watcher-check 2>&1 || true
      pid="$(docker inspect -f '{{.State.Pid}}' den-watcher-check 2> /dev/null || true)"
      if [[ -n "$pid" && "$pid" != 0 ]]; then
        echo "--- its cgroup"
        cat "/proc/$pid/cgroup" || true
      fi
      echo "--- Docker"
      docker info -f 'DockerRootDir={{.DockerRootDir}} CgroupDriver={{.CgroupDriver}} CgroupVersion={{.CgroupVersion}}' || true
      echo "--- containers.json"
      cat /run/den-watcher-addons/containers.json || true
      echo
      echo "--- the containers add-on"
      systemctl status --no-pager den-watcher-containers || true
      journalctl -u den-watcher-containers --no-pager | tail -20 || true
    } >&2
  fi
  docker rm -f den-watcher-check > /dev/null
  docker rmi den-watcher-check > /dev/null
  docker_check=false
  [[ "$reported" == true ]] || { echo "the containers add-on did not report the running container" >&2; exit 1; }
else
  addon_reports containers "" "the containers add-on wrote no report"
fi
"$folder/install.sh" < /dev/null
systemctl is-active --quiet den-watcher-power || { echo "the update removed the power add-on" >&2; exit 1; }
systemctl is-active --quiet den-watcher-containers || { echo "the update removed the containers add-on" >&2; exit 1; }
answer /api/metrics > /dev/null
# The pressure add-on reads /proc/pressure, which a kernel without pressure
# stall information lacks; it then runs but reports nothing. The kernel add-on
# reads /proc, which every runner has. The Wi-Fi add-on runs too; a runner
# without Wi-Fi gets a report without values, through the link to the folder
# its throwaway user writes to. The ports add-on reads the
# host's socket tables, which every runner has. The Bluetooth add-on runs
# too; a runner without Bluetooth gets a report without values, through the
# link to the folder its throwaway user writes to. All seven add-ons are
# installed, so --addons= below has to remove them all.
"$folder/install.sh" --addons=power,pressure,kernel,wifi,ports,containers,bluetooth
systemctl is-active --quiet den-watcher-pressure || { journalctl -u den-watcher-pressure --no-pager | tail -20 >&2; echo "the pressure add-on is not running" >&2; exit 1; }
[[ ! -f /proc/pressure/cpu ]] || addon_reports pressure '"cpu-some"' "the pressure add-on reported no CPU pressure"
addon_reports kernel '"tcp-established"' "the kernel add-on wrote no report"
addon_reports wifi "" "the Wi-Fi add-on wrote no report"
addon_reports ports '"id":"ports"' "the ports add-on wrote no ports"
addon_reports bluetooth '"extras"' "the Bluetooth add-on wrote no report"
"$folder/install.sh" --addons=
for addon in power pressure kernel wifi ports containers bluetooth; do
  ! installed "den-watcher-$addon" || { echo "--addons= left the $addon add-on behind" >&2; exit 1; }
done
[[ ! -L /run/den-watcher-addons/bluetooth.json ]] || { echo "--addons= left the Bluetooth add-on behind" >&2; exit 1; }
[[ ! -L /run/den-watcher-addons/wifi.json ]] || { echo "--addons= left the Wi-Fi add-on behind" >&2; exit 1; }

# --addons=cub installs the Cub edition: the lightweight add-ons, and only those.
"$folder/install.sh" --addons=cub
for addon in kernel memory pressure wifi inodes; do
  systemctl is-enabled --quiet "den-watcher-$addon" || { echo "--addons=cub did not install the $addon add-on" >&2; exit 1; }
done
for addon in power gpu processes ports smart containers bluetooth; do
  if systemctl cat "den-watcher-$addon" > /dev/null 2>&1; then
    echo "--addons=cub installed the $addon add-on" >&2
    exit 1
  fi
done
"$folder/install.sh" --addons=

# A group's name installs its add-ons, and only those.
"$folder/install.sh" --addons=network
for addon in wifi ports; do
  systemctl is-enabled --quiet "den-watcher-$addon" || { echo "--addons=network did not install the $addon add-on" >&2; exit 1; }
done
if systemctl cat den-watcher-kernel > /dev/null 2>&1; then
  echo "--addons=network installed the kernel add-on" >&2
  exit 1
fi
# The Wi-Fi add-on takes WIFI_NEARBY from the settings file.
systemctl show -p EnvironmentFiles den-watcher-wifi | grep -q /etc/den-watcher.env || { echo "the Wi-Fi add-on does not read /etc/den-watcher.env" >&2; exit 1; }
"$folder/install.sh" --addons=

# The gpu add-on runs without an NVIDIA GPU too, and then reports nothing.
"$folder/install.sh" --addons=gpu
addon_reports gpu "" "the gpu add-on wrote no report"
"$folder/install.sh" --addons=
! installed den-watcher-gpu || { echo "--addons= left the gpu add-on behind" >&2; exit 1; }

# The smart add-on runs and writes its report also where no disk answers
# SMART commands, as on a CI machine's virtual disks.
"$folder/install.sh" --addons=smart
addon_reports smart "" "the smart add-on wrote no report"
"$folder/install.sh" --addons=power
! installed den-watcher-smart || { echo "--addons=power left the smart add-on behind" >&2; exit 1; }

# The inodes add-on runs next to them and reports at least the root
# filesystem; the power add-on stays installed. The memory add-on runs next
# to them too, all writing to the shared add-on folder, and the processes
# add-on lists the busiest processes, the CPU ones from its second read on.
# The kernel, memory and processes add-ons stay for the uninstall to remove.
"$folder/install.sh" --addons=power,inodes,kernel,memory,processes
addon_reports inodes '"label":"/"' "the inodes add-on reported no root filesystem"
# It takes DOCKER_DIR from the settings file, but not ADDONS_DIR.
systemctl show -p EnvironmentFiles den-watcher-inodes | grep -q /etc/den-watcher.env || { echo "the inodes add-on does not read /etc/den-watcher.env" >&2; exit 1; }
systemctl show -p UnsetEnvironment den-watcher-inodes | grep -q ADDONS_DIR || { echo "the inodes add-on does not unset ADDONS_DIR" >&2; exit 1; }
systemctl is-active --quiet den-watcher-power || { echo "adding the inodes add-on stopped the power add-on" >&2; exit 1; }
addon_reports memory '"id":"committed"' "the memory add-on wrote no report"
systemctl is-active --quiet den-watcher-processes || { journalctl -u den-watcher-processes --no-pager | tail -20 >&2; echo "the processes add-on is not running" >&2; exit 1; }
for _ in $(seq 1 15); do
  grep -qs '"id":"processes-cpu"' /run/den-watcher-addons/processes.json && break
  sleep 1
done
grep -q '"id":"processes-memory"' /run/den-watcher-addons/processes.json || { echo "the processes add-on reported no processes by memory" >&2; exit 1; }
grep -q '"id":"processes-cpu"' /run/den-watcher-addons/processes.json || { echo "the processes add-on reported no processes by CPU" >&2; exit 1; }
# Once power has written its report, it must be able to write it again.
addon_reports power "" "the power add-on wrote no report"
rm /run/den-watcher-addons/power.json
addon_reports power "" "the power add-on can no longer write next to the other add-ons"

# A mistyped --purge changes nothing instead of uninstalling and keeping the history.
if "$folder/install.sh" --uninstall --purge-all 2> /dev/null; then
  echo "install.sh took the unknown option --purge-all" >&2
  exit 1
fi
installed den-watcher || { echo "install.sh changed the install on an unknown option" >&2; exit 1; }

# --purge also deletes settings made with systemctl edit.
mkdir -p /etc/systemd/system/den-watcher-power.service.d
printf '[Service]\nEnvironment=CHECK=1\n' > /etc/systemd/system/den-watcher-power.service.d/override.conf
"$folder/install.sh" --uninstall --purge
for name in den-watcher den-watcher-{power,inodes,kernel,memory,processes}; do
  ! installed "$name" || { echo "the uninstall left den-watcher behind" >&2; exit 1; }
done
[[ ! -e /etc/den-watcher.env && ! -e /etc/systemd/system/den-watcher-power.service.d ]] || { echo "the uninstall left den-watcher behind" >&2; exit 1; }
echo "Install, update, the power, pressure, kernel, Wi-Fi, ports, containers, gpu, smart, inodes, memory and processes add-ons and uninstall work."
