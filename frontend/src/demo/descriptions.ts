/**
 * What the add-ons and routers tell about each group of extras, by its id, as the backend writes it
 * (description and descriptions), so the demo's cards have their (i) too.
 */
export const descriptions: Record<
  string,
  { description: string; descriptions: Record<string, string> }
> = {
  inodes: {
    description:
      'How many of the inodes of each file system are in use. Every file and folder takes one, so a file system can be full while space is still free.',
    descriptions: {
      de: 'Wie viele Inodes jedes Dateisystems belegt sind. Jede Datei und jeder Ordner braucht einen, sodass ein Dateisystem voll sein kann, obwohl noch Platz frei ist.',
      fr: "La part des inodes de chaque système de fichiers utilisée. Chaque fichier et dossier en prend un : un système de fichiers peut être plein alors qu'il reste de la place.",
      es: 'Cuántos inodos de cada sistema de archivos están en uso. Cada archivo y carpeta ocupa uno, así que un sistema de archivos puede llenarse aunque quede espacio.',
    },
  },
  pressure: {
    description:
      'Whether the machine runs short of CPU, memory or disks: how much tasks had to wait for them. Values above zero mean that part holds the machine back.',
    descriptions: {
      de: 'Ob dem Gerät CPU, Arbeitsspeicher oder Datenträger knapp werden: wie viel Prozesse auf sie warten mussten. Werte über null heißen, dass dieser Teil das Gerät bremst.',
      fr: 'Si la machine manque de processeur, de mémoire ou de disque : combien les tâches ont dû les attendre. Au-dessus de zéro, cette partie freine la machine.',
      es: 'Si al equipo le falta CPU, memoria o disco: cuánto tuvieron que esperarlos las tareas. Por encima de cero, esa parte frena el equipo.',
    },
  },
  'den-watcher': {
    description:
      'What Den-Watcher itself uses of this device: its program and add-ons together, and the size of its history. On Windows, reads and writes include network traffic.',
    descriptions: {
      de: 'Was Den-Watcher selbst auf diesem Gerät belegt: sein Programm und die Add-ons zusammen, und die Größe seines Verlaufs. Unter Windows zählt beim Lesen und Schreiben auch der Netzwerkverkehr mit.',
      fr: "Ce que Den-Watcher utilise lui-même sur cet appareil : son programme et ses modules ensemble, et la taille de son historique. Sous Windows, la lecture et l'écriture incluent le trafic réseau.",
      es: 'Lo que usa el propio Den-Watcher en este dispositivo: su programa y sus complementos juntos, y el tamaño de su historial. En Windows, la lectura y la escritura incluyen el tráfico de red.',
    },
  },
  'containers-cpu': {
    description: 'How much CPU each running container uses.',
    descriptions: {
      de: 'Wie viel CPU jeder laufende Container nutzt.',
      fr: "L'utilisation du processeur par chaque conteneur en cours d'exécution.",
      es: 'Cuánta CPU usa cada contenedor en ejecución.',
    },
  },
  'containers-memory': {
    description: 'How much memory each running container uses.',
    descriptions: {
      de: 'Wie viel Arbeitsspeicher jeder laufende Container belegt.',
      fr: "La mémoire utilisée par chaque conteneur en cours d'exécution.",
      es: 'Cuánta memoria usa cada contenedor en ejecución.',
    },
  },
  'smart-checks': {
    description:
      'Whether each disk passes its own SMART self-assessment. A failed check means the disk expects to fail soon.',
    descriptions: {
      de: 'Ob jedes Laufwerk seine eigene SMART-Prüfung besteht. Eine nicht bestandene Prüfung heißt, dass das Laufwerk bald auszufallen droht.',
      fr: 'Si chaque disque réussit son propre contrôle SMART. Un contrôle échoué signifie que le disque risque de tomber en panne bientôt.',
      es: 'Si cada disco supera su propia comprobación SMART. Una comprobación fallida significa que el disco podría fallar pronto.',
    },
  },
  smart: {
    description:
      'What each disk reports about itself: its temperature, hours in use, replaced sectors, media errors and how worn an SSD is. Rising error counts are an early warning.',
    descriptions: {
      de: 'Was jedes Laufwerk über sich meldet: Temperatur, Betriebsstunden, ersetzte Sektoren, Medienfehler und den Verschleiß einer SSD. Steigende Fehlerzahlen sind eine frühe Warnung.',
      fr: "Ce que chaque disque indique sur lui-même : sa température, ses heures de fonctionnement, ses secteurs réalloués, ses erreurs de support et l'usure d'un SSD. Des erreurs en hausse sont un signe avant-coureur.",
      es: 'Lo que cada disco informa de sí mismo: su temperatura, horas de funcionamiento, sectores reasignados, errores de medio y el desgaste de un SSD. Si los errores aumentan, es una señal de alerta.',
    },
  },
  wifi: {
    description:
      'How good the Wi-Fi connection of each wireless interface is, with its signal level.',
    descriptions: {
      de: 'Wie gut die WLAN-Verbindung jeder Funkschnittstelle ist, mit ihrem Signalpegel.',
      fr: 'La qualité de la connexion Wi-Fi de chaque interface sans fil, avec le niveau du signal.',
      es: 'La calidad de la conexión Wi-Fi de cada interfaz inalámbrica, con su nivel de señal.',
    },
  },
  'wifi-networks': {
    description:
      "The Wi-Fi networks this device sees, from the scans its system makes on its own: each one's signal, with its history showing when it was in range, channel, band and security.",
    descriptions: {
      de: 'Die WLAN-Netze, die dieses Gerät sieht, aus den Suchläufen, die sein System von sich aus macht: Signal jedes Netzes, dessen Verlauf zeigt, wann es in Reichweite war, Kanal, Band und Sicherheit.',
      fr: "Les réseaux Wi-Fi que cet appareil voit, d'après les recherches que son système fait de lui-même : le signal de chacun, dont l'historique montre quand il était à portée, son canal, sa bande et sa sécurité.",
      es: 'Las redes Wi-Fi que ve este dispositivo, según las búsquedas que su sistema hace por sí mismo: la señal de cada una, cuyo historial muestra cuándo estuvo al alcance, su canal, su banda y su seguridad.',
    },
  },
  'processes-cpu': {
    description: 'The processes that use the most CPU right now.',
    descriptions: {
      de: 'Die Prozesse, die gerade am meisten CPU nutzen.',
      fr: 'Les processus qui utilisent le plus le processeur en ce moment.',
      es: 'Los procesos que más CPU usan ahora mismo.',
    },
  },
  'processes-memory': {
    description: 'The processes that use the most memory right now.',
    descriptions: {
      de: 'Die Prozesse, die gerade am meisten Arbeitsspeicher belegen.',
      fr: 'Les processus qui utilisent le plus de mémoire en ce moment.',
      es: 'Los procesos que más memoria usan ahora mismo.',
    },
  },
  power: {
    description:
      'How much power the parts of the machine draw, largest first, as far as their sensors tell it.',
    descriptions: {
      de: 'Wie viel Leistung die Teile des Geräts aufnehmen, die größte zuerst, soweit ihre Sensoren es melden.',
      fr: "La puissance consommée par les composants de la machine, la plus forte en premier, pour autant que leurs capteurs l'indiquent.",
      es: 'Cuánta potencia consumen las partes del equipo, la mayor primero, según lo que indican sus sensores.',
    },
  },
  gpu: {
    description:
      'More of what the graphics card reports: its fan, clock speeds and how busy its video encoder and decoder are.',
    descriptions: {
      de: 'Mehr von dem, was die Grafikkarte meldet: Lüfter, Taktraten und wie ausgelastet Video-Encoder und -Decoder sind.',
      fr: "D'autres valeurs de la carte graphique : son ventilateur, ses fréquences et l'occupation de l'encodeur et du décodeur vidéo.",
      es: 'Más de lo que informa la tarjeta gráfica: su ventilador, sus frecuencias y la carga del codificador y el decodificador de vídeo.',
    },
  },
  ports: {
    description:
      'The TCP and UDP ports that programs on the machine listen on, with the addresses they listen on. 0.0.0.0 and :: mean every address.',
    descriptions: {
      de: 'Die TCP- und UDP-Ports, auf denen Programme des Geräts lauschen, mit den Adressen dazu. 0.0.0.0 und :: stehen für alle Adressen.',
      fr: 'Les ports TCP et UDP sur lesquels les programmes de la machine écoutent, avec leurs adresses. 0.0.0.0 et :: signifient toutes les adresses.',
      es: 'Los puertos TCP y UDP en los que escuchan los programas del equipo, con sus direcciones. 0.0.0.0 y :: significan todas las direcciones.',
    },
  },
  kernel: {
    description: 'How often per second the kernel switches between threads and handles interrupts.',
    descriptions: {
      de: 'Wie oft pro Sekunde der Kernel zwischen Threads wechselt und Interrupts bearbeitet.',
      fr: 'Combien de fois par seconde le noyau change de thread et traite des interruptions.',
      es: 'Cuántas veces por segundo el núcleo cambia de hilo y atiende interrupciones.',
    },
  },
  'kernel-processes': {
    description: 'How many new processes and threads start per second.',
    descriptions: {
      de: 'Wie viele neue Prozesse und Threads pro Sekunde starten.',
      fr: 'Le nombre de nouveaux processus et threads lancés par seconde.',
      es: 'Cuántos procesos e hilos nuevos se inician por segundo.',
    },
  },
  'kernel-in-use': {
    description: 'How many files, handles and sockets are open on the machine.',
    descriptions: {
      de: 'Wie viele Dateien, Handles und Sockets auf dem Gerät offen sind.',
      fr: 'Le nombre de fichiers, handles et sockets ouverts sur la machine.',
      es: 'Cuántos archivos, handles y sockets hay abiertos en el equipo.',
    },
  },
  'kernel-tcp': {
    description:
      'The TCP connections that are open, and how many packets per second had to be sent again. Many retransmissions point to a bad network.',
    descriptions: {
      de: 'Die offenen TCP-Verbindungen und wie viele Pakete pro Sekunde erneut gesendet werden mussten. Viele Neuübertragungen deuten auf ein schlechtes Netz hin.',
      fr: 'Les connexions TCP ouvertes et le nombre de paquets renvoyés par seconde. Beaucoup de retransmissions signalent un mauvais réseau.',
      es: 'Las conexiones TCP abiertas y cuántos paquetes por segundo hubo que reenviar. Muchas retransmisiones indican una mala red.',
    },
  },
  memory: {
    description:
      'What the working memory holds besides programs: kernel caches and pools, shared memory and page tables.',
    descriptions: {
      de: 'Was der Arbeitsspeicher außer Programmen enthält: Kernel-Caches und -Pools, gemeinsamen Speicher und Seitentabellen.',
      fr: 'Ce que la mémoire contient en dehors des programmes : caches et pools du noyau, mémoire partagée et tables de pages.',
      es: 'Lo que contiene la memoria además de los programas: cachés y bloques del núcleo, memoria compartida y tablas de páginas.',
    },
  },
  'memory-committed': {
    description: 'How much memory programs have been promised, which can be more than there is.',
    descriptions: {
      de: 'Wie viel Speicher den Programmen zugesagt ist; das kann mehr sein, als vorhanden ist.',
      fr: 'La mémoire promise aux programmes, qui peut dépasser celle disponible.',
      es: 'Cuánta memoria se ha prometido a los programas, que puede ser más de la que hay.',
    },
  },
  'memory-writeback': {
    description:
      'Changed data in memory that is not written to disk yet, and what is being written now.',
    descriptions: {
      de: 'Geänderte Daten im Arbeitsspeicher, die noch nicht auf den Datenträger geschrieben sind, und was gerade geschrieben wird.',
      fr: "Les données modifiées en mémoire pas encore écrites sur le disque, et celles en cours d'écriture.",
      es: 'Los datos modificados en memoria que aún no se han escrito en el disco, y los que se están escribiendo.',
    },
  },
  'memory-faults': {
    description:
      'How often per second programs touch memory that is not mapped for them yet. Most are handled without the disk.',
    descriptions: {
      de: 'Wie oft pro Sekunde Programme auf Speicher zugreifen, der ihnen noch nicht zugeordnet ist. Die meisten werden ohne Datenträger erledigt.',
      fr: 'Combien de fois par seconde les programmes accèdent à de la mémoire qui ne leur est pas encore attribuée. La plupart sont traités sans le disque.',
      es: 'Cuántas veces por segundo los programas acceden a memoria que aún no tienen asignada. La mayoría se resuelven sin el disco.',
    },
  },
  'memory-disk': {
    description:
      'How much memory has to be read from or written to disk per second. A lot of it means the machine is short of memory.',
    descriptions: {
      de: 'Wie viel Speicher pro Sekunde vom Datenträger gelesen oder dorthin geschrieben werden muss. Viel davon heißt, dass dem Gerät Arbeitsspeicher fehlt.',
      fr: 'La quantité de mémoire lue ou écrite sur le disque par seconde. Beaucoup signifie que la machine manque de mémoire.',
      es: 'Cuánta memoria hay que leer del disco o escribir en él por segundo. Mucha indica que al equipo le falta memoria.',
    },
  },
  clients: {
    description: "How many devices are online in the router's network, on a cable and on Wi-Fi.",
    descriptions: {
      de: 'Wie viele Geräte im Netz des Routers online sind, per Kabel und per WLAN.',
      fr: "Le nombre d'appareils en ligne sur le réseau du routeur, par câble et en Wi-Fi.",
      es: 'Cuántos dispositivos están en línea en la red del router, por cable y por Wi-Fi.',
    },
  },
  'aimesh-node': {
    description:
      'What the main router of the AiMesh tells about this node: how it is linked to the mesh, how many devices are connected to it, its model and firmware.',
    descriptions: {
      de: 'Was der Hauptrouter des AiMesh über diesen Knoten meldet: wie er mit dem Mesh verbunden ist, wie viele Geräte mit ihm verbunden sind, sein Modell und seine Firmware.',
      fr: "Ce que le routeur principal de l'AiMesh indique sur ce nœud : comment il est relié au maillage, combien d'appareils y sont connectés, son modèle et son firmware.",
      es: 'Lo que el router principal del AiMesh indica sobre este nodo: cómo está unido a la malla, cuántos dispositivos están conectados a él, su modelo y su firmware.',
    },
  },
  connected: {
    description:
      "The devices online in the router's network right now, each with how it is connected.",
    descriptions: {
      de: 'Die Geräte, die gerade im Netz des Routers online sind, jeweils mit ihrer Verbindungsart.',
      fr: 'Les appareils en ligne sur le réseau du routeur en ce moment, chacun avec son type de connexion.',
      es: 'Los dispositivos en línea en la red del router ahora mismo, cada uno con su tipo de conexión.',
    },
  },
  reachability: {
    description:
      'How long it took to answer the hub, which checks it every 15 seconds. It runs no den-watcher, so this is all the hub knows of it.',
    descriptions: {
      de: 'Wie lange die Antwort an den Hub dauerte, der alle 15 Sekunden prüft. Hier läuft kein den-watcher, daher weiß der Hub nur das.',
      fr: "Le temps de réponse au hub, qui vérifie toutes les 15 secondes. Aucun den-watcher n'y tourne, le hub ne sait donc que cela.",
      es: 'El tiempo que tardó en responder al hub, que lo comprueba cada 15 segundos. No ejecuta den-watcher, así que es todo lo que el hub sabe.',
    },
  },
  bluetooth: {
    description:
      'The Bluetooth devices connected to the machine, each with its battery level or its kind.',
    descriptions: {
      de: 'Die mit dem Gerät verbundenen Bluetooth-Geräte, jeweils mit Akkustand oder Geräteart.',
      fr: 'Les appareils Bluetooth connectés à la machine, chacun avec son niveau de batterie ou son type.',
      es: 'Los dispositivos Bluetooth conectados al equipo, cada uno con su nivel de batería o su tipo.',
    },
  },
};

/** What a check by ping tells about its reachability, which says more than one over TCP. */
export const pingReachability = {
  description:
    'How long it took to answer the hub, which pings it 5 times every 15 seconds, how many of the pings got no answer, and how much the answers varied. It runs no den-watcher, so this is all the hub knows of it.',
  descriptions: {
    de: 'Wie lange die Antwort an den Hub dauerte, der alle 15 Sekunden 5 Pings sendet, wie viele davon keine Antwort bekamen und wie stark die Antworten schwankten. Hier läuft kein den-watcher, daher weiß der Hub nur das.',
    fr: "Le temps de réponse au hub, qui envoie 5 pings toutes les 15 secondes, combien sont restés sans réponse et à quel point les réponses ont varié. Aucun den-watcher n'y tourne, le hub ne sait donc que cela.",
    es: 'El tiempo que tardó en responder al hub, que envía 5 pings cada 15 segundos, cuántos quedaron sin respuesta y la variación de las respuestas. No ejecuta den-watcher, así que es todo lo que el hub sabe.',
  },
};
