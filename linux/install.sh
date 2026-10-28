#!/usr/bin/env bash
# Installs or updates den-watcher as a systemd service, from the folder of an
# unpacked release archive (den-watcher-<version>-linux-<arch>.tar.gz):
#
#   sudo ./install.sh                    # install, or update to this version
#   sudo ./install.sh --addons=cub       # install the Cub edition
#   sudo ./install.sh --addons=cub,power # Grizzly: Cub with the power add-on
#   sudo ./install.sh --addons=cub,network # Grizzly: Cub with every network add-on
#   sudo ./install.sh --addons=          # install without any add-on
#   sudo ./install.sh --uninstall        # remove it; add --purge to delete settings and history too
#
# Run in a terminal, it also asks whether to read the router, and for its
# login when the router needs one (ASUS, FRITZ!Box, SNMPv3) or its SNMP
# community. The login is stored encrypted with
# systemd-creds, and only the service can read it.
#
# Add-ons are optional programs that collect more data than den-watcher itself,
# each as a service of its own. Run in a terminal without --addons, the
# install first asks for the edition: Cub is den-watcher with the
# lightweight add-ons, Grizzly lets you choose which data to collect, group by group
# (System details, Hardware, Network, Bluetooth, Processes and containers),
# then each add-on of a group and what some of them collect, starting from
# Cub's. Without a terminal, an update keeps the add-ons installed before. In
# --addons, cub stands for the lightweight add-ons and a group's name, such as
# network, for all of its add-ons.
#
# Settings live in /etc/den-watcher.env and the history in
# /var/lib/den-watcher; an update keeps both. --uninstall --purge deletes
# them, with any settings made with systemctl edit (den-watcher*.service.d).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
binary=/usr/local/bin/den-watcher
unit=/etc/systemd/system/den-watcher.service
settings=/etc/den-watcher.env
# The router passwords, encrypted with systemd-creds, and the setting that
# hands them to the service.
router_passwords=/etc/den-watcher-router-passwords.cred
router_dropin=/etc/systemd/system/den-watcher.service.d/router-passwords.conf

# The lightweight add-ons, which make up the Cub edition: each reads a few
# small files or counters per poll.
cub_addons=(kernel memory pressure wifi inodes)

# The groups the add-ons are offered in, in this order, each with its title
# and add-ons; the same groups as the Windows installer, Docker's profiles
# and the Android app's options.
groups=(details hardware network bluetooth programs)
declare -A group_titles=(
  [details]="System details"
  [hardware]="Hardware"
  [network]="Network"
  [bluetooth]="Bluetooth"
  [programs]="Processes and containers"
)
declare -A group_addons=(
  [details]="kernel memory pressure inodes"
  [hardware]="power gpu smart"
  [network]="wifi ports"
  [bluetooth]="bluetooth"
  [programs]="processes containers"
)

if [[ $EUID -ne 0 ]]; then
  echo "Run this as root, for example: sudo $0 $*" >&2
  exit 1
fi
if ! command -v systemctl > /dev/null || [[ ! -d /run/systemd/system ]]; then
  echo "This machine does not run systemd. Start $here/den-watcher by hand, or use Docker (see the README)." >&2
  exit 1
fi

# The options and the archive's files are checked before anything changes,
# so a mistyped option leaves an install from before the rename running.
case "${1:-}" in
  --uninstall | "") ;;
  --addons=*)
    IFS=, read -r -a picked <<< "${1#--addons=}"
    for addon in "${picked[@]}"; do
      if [[ $addon != cub && -z "${group_addons[$addon]+set}" && ! -f "$here/den-watcher-$addon.service" ]]; then
        echo "There is no add-on called '$addon' in this archive." >&2
        exit 1
      fi
    done
    ;;
  *)
    echo "Unknown option $1. Use --addons=<names>, --uninstall or --uninstall --purge." >&2
    exit 1
    ;;
esac
if [[ "${1:-}" != --uninstall ]]; then
  for file in den-watcher den-watcher.service den-watcher.env.example; do
    if [[ ! -f "$here/$file" ]]; then
      echo "$here/$file is missing; run install.sh from the unpacked release archive." >&2
      exit 1
    fi
  done
fi

# Moves an install from before the rename (usage-control, 2.0.7a and older)
# to the new names, once: its settings, router password, settings made with
# systemctl edit and history move along, and its add-on services are taken
# over as the den-watcher ones, which the install below then replaces. An
# install removed with --uninstall left its settings and history, which move
# too.
if [[ -e /etc/systemd/system/usage-control.service || -e /usr/local/bin/usage-control || -e /etc/usage-control.env ]] ||
  [[ (-d /var/lib/private/usage-control || -d /var/lib/usage-control) && ! -e /var/lib/private/den-watcher && ! -e /var/lib/den-watcher ]]; then
  echo "Moving usage-control to its new name, den-watcher, with its settings, add-ons and history."
  for old in /etc/systemd/system/usage-control*.service; do
    if [[ -f "$old" ]]; then
      systemctl disable --now "$(basename "$old")" 2> /dev/null || true
    fi
  done
  for old in /etc/systemd/system/usage-control-*.service /etc/systemd/system/usage-control*.service.d; do
    new="/etc/systemd/system/den-watcher${old#/etc/systemd/system/usage-control}"
    [[ -e "$old" && ! -e "$new" ]] && mv "$old" "$new"
  done
  if [[ -f /etc/usage-control.env && ! -f "$settings" ]]; then
    mv /etc/usage-control.env "$settings"
  fi
  if [[ -f /etc/usage-control-router-passwords.cred && ! -f "$router_passwords" ]]; then
    mv /etc/usage-control-router-passwords.cred "$router_passwords"
  fi
  if [[ -f "$router_dropin" ]]; then
    sed -i "s|/etc/usage-control-router-passwords.cred|$router_passwords|" "$router_dropin"
  fi
  # With DynamicUser the history is in /var/lib/private, behind a link in
  # /var/lib; systemd hands it to the new service's user when it starts.
  if [[ -d /var/lib/private/usage-control && ! -e /var/lib/private/den-watcher ]]; then
    mv /var/lib/private/usage-control /var/lib/private/den-watcher
    rm -f /var/lib/usage-control
  elif [[ -d /var/lib/usage-control && ! -L /var/lib/usage-control && ! -e /var/lib/den-watcher ]]; then
    mv /var/lib/usage-control /var/lib/den-watcher
  elif [[ -d /var/lib/private/usage-control || -d /var/lib/usage-control ]]; then
    echo "den-watcher already has a history, so the one from usage-control stays in /var/lib/private/usage-control (or /var/lib/usage-control); delete it once it is no longer needed." >&2
  fi
  rm -f /usr/local/bin/usage-control /usr/local/bin/usage-control-* /etc/systemd/system/usage-control.service
  rm -rf /run/usage-control-addons
  systemctl daemon-reload
fi

# Every add-on there is: those in this archive and those installed before,
# each with what it does for the question at install, from the
# "Description=Den-Watcher <name> add-on: <what it does>" of its service.
declare -A addon_descriptions=()
for service in "$here"/den-watcher-*.service /etc/systemd/system/den-watcher-*.service; do
  [[ -f "$service" ]] || continue
  addon="$(basename "$service" .service)"
  addon="${addon#den-watcher-}"
  [[ -n "${addon_descriptions[$addon]+set}" ]] && continue
  addon_descriptions[$addon]="$(sed -n 's/^Description=Den-Watcher [^:]* add-on: //p' "$service")"
done

# How the questions name each add-on.
declare -A addon_titles=(
  [kernel]="kernel" [memory]="memory details" [pressure]="pressure" [inodes]="inodes"
  [power]="power draw" [gpu]="graphics card details" [smart]="disk health"
  [wifi]="Wi-Fi quality and networks nearby" [ports]="listening ports"
  [bluetooth]="connected devices" [processes]="top processes" [containers]="containers"
)

# The settings that choose what an add-on collects, each asked for right
# after its add-on in Grizzly, and the question for it. Each takes 0 or 1,
# 1 by default.
declare -A addon_switches=([wifi]=WIFI_NEARBY [bluetooth]=BLUETOOTH_NAMES)
declare -A switch_questions=(
  [WIFI_NEARBY]="Also the Wi-Fi networks nearby, not only the connected one's quality?"
  [BLUETOOTH_NAMES]="Show the devices' names? Without, each shows as its kind, such as Headphones."
)
# The answers, written to the settings file at install.
declare -A switches=()

# Prints how the questions name the add-on $1.
addon_title() {
  printf '%s' "${addon_titles[$1]:-$1}"
}

# Prints its arguments joined by ", ".
joined() {
  local first="$1" item
  shift
  printf '%s' "$first"
  for item in "$@"; do
    printf ', %s' "$item"
  done
}

# Prints the value of the setting $1 in the settings file, without quotes
# or spaces; nothing when it is not set or there is no file yet.
setting() {
  sed -n "s/^$1=//p" "$settings" 2> /dev/null | tail -n 1 | tr -d '[:space:]"'\''' || true
}

# Removes one add-on's service and program.
remove_addon() {
  systemctl disable --now "den-watcher-$1.service" 2> /dev/null || true
  rm -f "/usr/local/bin/den-watcher-$1" "/etc/systemd/system/den-watcher-$1.service"
}

if [[ "${1:-}" == --uninstall ]]; then
  for addon in "${!addon_descriptions[@]}"; do
    remove_addon "$addon"
  done
  systemctl disable --now den-watcher.service 2> /dev/null || true
  rm -f "$binary" "$unit"
  # The add-on folder only holds the add-ons' last values; systemd keeps it
  # until the next boot (RuntimeDirectoryPreserve), so it goes now.
  rm -rf /run/den-watcher-addons
  systemctl daemon-reload
  if [[ "${2:-}" == --purge ]]; then
    # Settings made with systemctl edit are settings too.
    rm -rf /var/lib/den-watcher /var/lib/private/den-watcher "$settings" "$router_passwords" /etc/systemd/system/den-watcher*.service.d
    systemctl daemon-reload
    echo "den-watcher, its settings and its history are removed."
  else
    echo "den-watcher is removed. Its settings ($settings) and history (/var/lib/den-watcher) are kept; --uninstall --purge deletes them."
  fi
  exit 0
fi

# The add-ons to install: from --addons, else asked in a terminal, else the
# ones installed before.
declare -A wanted=()
declare -A cub=()
for addon in "${cub_addons[@]}"; do
  cub[$addon]=1
done
if [[ "${1:-}" == --addons=* ]]; then
  IFS=, read -r -a picked <<< "${1#--addons=}"
  for addon in "${picked[@]}"; do
    if [[ $addon == cub ]]; then
      for light in "${cub_addons[@]}"; do
        [[ -f "$here/den-watcher-$light.service" ]] && wanted[$light]=1
      done
      continue
    fi
    # A group's name, such as network, stands for its add-ons in this
    # archive; bluetooth is a group and its one add-on alike.
    if [[ -n "${group_addons[$addon]+set}" ]]; then
      for member in ${group_addons[$addon]}; do
        [[ -f "$here/den-watcher-$member.service" ]] && wanted[$member]=1
      done
      continue
    fi
    if [[ -z "${addon_descriptions[$addon]+set}" || ! -f "$here/den-watcher-$addon.service" ]]; then
      echo "There is no add-on called '$addon'. Add-ons: cub ${groups[*]} ${!addon_descriptions[*]}" >&2
      exit 1
    fi
    wanted[$addon]=1
  done
elif [[ -t 0 ]]; then
  # Grizzly is the default when one of its add-ons is installed already.
  edition=1
  installed_any=""
  for addon in "${!addon_descriptions[@]}"; do
    if [[ -f "/etc/systemd/system/den-watcher-$addon.service" ]]; then
      installed_any=1
      [[ -z "${cub[$addon]+set}" ]] && edition=2
    fi
  done
  echo "Which edition should this machine run?"
  echo "  1) Cub: den-watcher with the lightweight add-ons, which collect"
  for group in "${groups[@]}"; do
    members=()
    for addon in ${group_addons[$group]}; do
      [[ -n "${cub[$addon]+set}" && -f "$here/den-watcher-$addon.service" ]] && members+=("$(addon_title "$addon")")
    done
    if [[ ${#members[@]} -gt 0 ]]; then
      echo "       ${group_titles[$group]}: $(joined "${members[@]}")"
    fi
  done
  echo "  2) Grizzly: choose which data to collect, group by group, starting from Cub's"
  read -r -p "[1/2, default $edition] " answer
  answer="${answer:-$edition}"
  if [[ ! "$answer" =~ ^[12]$ ]]; then
    echo "Choose 1 or 2." >&2
    exit 1
  fi
  if [[ $answer == 1 ]]; then
    for addon in "${cub_addons[@]}"; do
      [[ -f "$here/den-watcher-$addon.service" ]] && wanted[$addon]=1
    done
  else
    # An add-on is ticked when it is installed, or on a machine without any
    # add-on yet, when it is one of Cub's. One that is no longer in this
    # archive is not asked for and is removed below.
    declare -A ticked=()
    for addon in "${!addon_descriptions[@]}"; do
      [[ -f "$here/den-watcher-$addon.service" ]] || continue
      if [[ -f "/etc/systemd/system/den-watcher-$addon.service" ]] || [[ -z "$installed_any" && -n "${cub[$addon]+set}" ]]; then
        ticked[$addon]=1
      fi
    done
    # Add-ons of a newer archive that no group names yet are asked for
    # last, on their own.
    grouped=" ${group_addons[*]} "
    others=()
    for addon in "${!addon_descriptions[@]}"; do
      [[ -f "$here/den-watcher-$addon.service" && "$grouped" != *" $addon "* ]] && others+=("$addon")
    done
    echo
    echo "Which data do you want to collect? CPU, memory, disks, network traffic, temperatures,"
    echo "graphics cards, battery and fans are always collected."
    for group in "${groups[@]}" other; do
      if [[ $group == other ]]; then
        members=("${others[@]}")
        title="Other add-ons"
      else
        members=()
        for addon in ${group_addons[$group]}; do
          [[ -f "$here/den-watcher-$addon.service" ]] && members+=("$addon")
        done
        title="${group_titles[$group]}"
      fi
      [[ ${#members[@]} -gt 0 ]] || continue
      default=n
      titles=()
      for addon in "${members[@]}"; do
        [[ -n "${ticked[$addon]+set}" ]] && default=y
        titles+=("$(addon_title "$addon")")
      done
      read -r -p "Collect $title ($(joined "${titles[@]}"))? [y/n, default $default] " answer
      [[ "${answer:-$default}" == [yY]* ]] || continue
      for addon in "${members[@]}"; do
        if [[ ${#members[@]} -eq 1 ]]; then
          wanted[$addon]=1
        else
          default=n
          [[ -n "${ticked[$addon]+set}" ]] && default=y
          read -r -p "  The $addon add-on? It ${addon_descriptions[$addon]}. [y/n, default $default] " answer
          [[ "${answer:-$default}" == [yY]* ]] && wanted[$addon]=1
        fi
        # What some add-ons collect is a setting of its own.
        if [[ -n "${wanted[$addon]+set}" && -n "${addon_switches[$addon]+set}" ]]; then
          switch="${addon_switches[$addon]}"
          default=y
          [[ "$(setting "$switch")" == 0 ]] && default=n
          read -r -p "    ${switch_questions[$switch]} [y/n, default $default] " answer
          if [[ "${answer:-$default}" == [yY]* ]]; then
            switches[$switch]=1
          else
            switches[$switch]=0
          fi
        fi
      done
    done
  fi
else
  for addon in "${!addon_descriptions[@]}"; do
    [[ -f "$here/den-watcher-$addon.service" && -f "/etc/systemd/system/den-watcher-$addon.service" ]] && wanted[$addon]=1
  done
fi

# The router to read: asked in a terminal only, and on an update only when
# asked to set it up again. Not on a device that only serves its usage to a
# hub (DATA_ONLY), which shows no routers and would not start with one.
router_entry=""
router_password=""
router_name=""
router_remove=""
kind=""
data_only="$(setting DATA_ONLY)"
if [[ -t 0 && "${1:-}" != --addons=* && ! "$data_only" =~ ^(1|t|T|true|TRUE|True)$ ]]; then
  # No settings file yet on a first install.
  current="$(sed -n 's/^HUB_ROUTERS=//p' "$settings" 2> /dev/null | tail -n 1 || true)"
  current="${current#\'}"
  current="${current%\'}"
  echo
  echo "den-watcher can also show your router: its internet traffic, and depending on the router"
  echo "its line, ports, clients, CPU, memory and temperatures."
  echo "Read from the router over the local network only. No data is sent to any server;"
  echo "everything stays on your own devices, and a router password is stored encrypted where"
  echo "the system allows it."
  if [[ -n "$current" ]]; then
    question="Set up the router again? It is now $current. [y/n, default n] "
  else
    question="Show your router? [y/n, default n] "
  fi
  read -r -p "$question" answer
  if [[ "${answer:-n}" == [yY]* ]]; then
    echo "Which router is it? A login is only asked for where the router needs one."
    echo "  1) Any router with UPnP (Technicolor, most internet providers' boxes): internet traffic,"
    echo "     no login; UPnP must be switched on in the router's settings"
    echo "  2) ASUS, with its login: CPU, memory, ports, Wi-Fi, clients and temperatures"
    echo "  3) FRITZ!Box, with a FRITZ!Box user: internet traffic, line, noise margin and clients;"
    echo "     allow access for applications in Home Network > Network > Network Settings"
    echo "  4) A router with SNMP v2c (MikroTik, OpenWrt, Ubiquiti, business routers): traffic"
    echo "     of every port, CPU and memory, with its community"
    echo "  5) A router with SNMPv3: the same, with a user and password"
    echo "  6) none: stop showing a router"
    read -r -p "[1-6, default 1] " kind
    kind="${kind:-1}"
    if [[ ! "$kind" =~ ^[1-6]$ ]]; then
      echo "Choose one of 1 to 6." >&2
      exit 1
    fi
  fi
  if [[ "$kind" == 6 ]]; then
    router_remove=1
  elif [[ -n "$kind" ]]; then
    gateway="$(ip -4 route show default 2> /dev/null | awk '{print $3; exit}' || true)"
    read -r -p "The router's address [default ${gateway:-none}] " address
    address="${address:-$gateway}"
    if [[ ! "$address" =~ ^[A-Za-z0-9.-]+$ ]]; then
      echo "The router's address must be a host name or IPv4 address, such as 192.168.1.1." >&2
      exit 1
    fi
    read -r -p "Its name on the page [default Router] " router_name
    router_name="${router_name:-Router}"
    if [[ ! "$router_name" =~ ^[A-Za-z0-9][A-Za-z0-9\ ._()-]{0,63}$ || "${router_name,,}" == local ]]; then
      echo "The router's name must start with a letter or digit and hold only letters, digits, spaces and . _ ( ) -, at most 64, and not be Local." >&2
      exit 1
    fi
    case "$kind" in
      1)
        router_entry="$router_name=upnp:$address"
        ;;
      2 | 3 | 5)
        case "$kind" in
          2) protocol=asus what="of its web interface" default_user=admin ;;
          3) protocol=fritzbox what="of the FRITZ!Box (System > FRITZ!Box Users)" default_user="" ;;
          5) protocol=snmpv3 what="of SNMPv3" default_user="" ;;
        esac
        read -r -p "The user $what${default_user:+ [default $default_user]} " user
        user="${user:-$default_user}"
        if [[ ! "$user" =~ ^[^[:space:]@=,:\']{1,64}$ ]]; then
          echo "The user must be given, without spaces, @, =, , : or '." >&2
          exit 1
        fi
        IFS= read -r -s -p "Its password (not shown): " router_password
        echo
        if [[ -z "$router_password" ]]; then
          echo "The router needs its password; run install.sh again to enter it." >&2
          exit 1
        fi
        if [[ "$protocol" == snmpv3 && ${#router_password} -lt 8 ]]; then
          echo "An SNMPv3 password has at least 8 characters." >&2
          exit 1
        fi
        router_entry="$router_name=$protocol:$user@$address"
        ;;
      4)
        IFS= read -r -s -p "Its SNMP community (not shown) [default public] " router_password
        echo
        # The community public needs no secret.
        if [[ "$router_password" == public ]]; then
          router_password=""
        fi
        router_entry="$router_name=snmp:$address"
        ;;
    esac
  fi
fi

for addon in "${!wanted[@]}"; do
  for file in "den-watcher-$addon" "den-watcher-$addon.service"; do
    if [[ ! -f "$here/$file" ]]; then
      echo "$here/$file is missing; run install.sh from the unpacked release archive." >&2
      exit 1
    fi
  done
done

install -m 0755 "$here/den-watcher" "$binary"
install -m 0644 "$here/den-watcher.service" "$unit"
if [[ ! -f "$settings" ]]; then
  install -m 0644 "$here/den-watcher.env.example" "$settings"
fi
for addon in "${!addon_descriptions[@]}"; do
  if [[ -n "${wanted[$addon]+set}" ]]; then
    install -m 0755 "$here/den-watcher-$addon" "/usr/local/bin/den-watcher-$addon"
    install -m 0644 "$here/den-watcher-$addon.service" "/etc/systemd/system/den-watcher-$addon.service"
  else
    remove_addon "$addon"
  fi
done
for switch in "${!switches[@]}"; do
  # Settings files from before the setting have no line for it yet.
  if grep -q "^$switch=" "$settings"; then
    sed -i "s|^$switch=.*|$switch=${switches[$switch]}|" "$settings"
  else
    printf '\n%s=%s\n' "$switch" "${switches[$switch]}" >> "$settings"
  fi
done
if [[ -n "$router_entry" || -n "$router_remove" ]]; then
  # Settings files from before routers have no HUB_ROUTERS line yet. In
  # single quotes, so systemd takes a user with \ or quotes as it is.
  if grep -q '^HUB_ROUTERS=' "$settings"; then
    escaped="$(printf '%s' "$router_entry" | sed 's/[\\&|]/\\&/g')"
    sed -i "s|^HUB_ROUTERS=.*|HUB_ROUTERS='$escaped'|" "$settings"
  else
    printf "\nHUB_ROUTERS='%s'\n" "$router_entry" >> "$settings"
  fi
  rm -f "$router_passwords" "$router_dropin"
  if [[ -n "$router_password" ]]; then
    mkdir -p "$(dirname "$router_dropin")"
    # Encrypted with the machine's own key (and its TPM, where there is
    # one), so the file is of no use elsewhere; systemd decrypts it only for
    # the service, into a folder only the service can read.
    if command -v systemd-creds > /dev/null && printf '%s=%s\n' "$router_name" "$router_password" |
      systemd-creds encrypt --name=router-passwords - "$router_passwords"; then
      chmod 600 "$router_passwords"
      printf '[Service]\nLoadCredentialEncrypted=router-passwords:%s\n' "$router_passwords" > "$router_dropin"
    else
      # systemd before 250 cannot encrypt it: kept readable by root only
      # (LoadCredential needs systemd 247 or newer).
      (umask 077 && printf '%s=%s\n' "$router_name" "$router_password" > "$router_passwords")
      printf '[Service]\nLoadCredential=router-passwords:%s\n' "$router_passwords" > "$router_dropin"
      echo "The router's password could not be encrypted with systemd-creds (systemd 250 or newer); it is stored readable by root only in $router_passwords." >&2
    fi
  fi
fi
systemctl daemon-reload
# Several installs in a row would hit systemd's limit of starts in a short
# time, which reset-failed clears.
systemctl reset-failed den-watcher.service 2> /dev/null || true
systemctl enable den-watcher.service > /dev/null
systemctl restart den-watcher.service
for addon in "${!wanted[@]}"; do
  systemctl reset-failed "den-watcher-$addon.service" 2> /dev/null || true
  systemctl enable "den-watcher-$addon.service" > /dev/null
  systemctl restart "den-watcher-$addon.service"
done

echo "den-watcher is running. Open http://<this machine's address>:9393 on the local network (or the port in LISTEN_ADDR)."
if [[ ${#wanted[@]} -gt 0 ]]; then
  echo "Add-ons: ${!wanted[*]}"
fi
if [[ -n "$router_entry" ]]; then
  echo "Router: ${router_entry%%=*}, shown as a device on the page"
elif [[ -n "$router_remove" ]]; then
  echo "No router is shown any more."
fi
echo "Settings: $settings, then: sudo systemctl restart den-watcher"
