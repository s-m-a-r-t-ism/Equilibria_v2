# Freestyle For Greatness

Een freestyle in vier bewegingen. Een gedicht, een beat en een sterrenhemel,
die alle drie live in de browser ontstaan op het moment dat je kijkt.

Er zit geen enkel geluidsbestand of plaatje in. Elke kick, elke snare, de
Rhodes-akkoorden, de bas, het vinylgekraak en de galm worden met de Web Audio
API gesynthetiseerd. Elke letter op het scherm is een zwerm van duizenden
lichtdeeltjes die zich even tot een woord vormen en daarna als sterrenbeeld aan
de hemel blijven hangen. Aan het eind heeft elk van de 32 regels een eigen
sterrenbeeld achtergelaten, en dan is het jouw beurt.

## Bekijken

Open `index.html` in een moderne browser (Chrome, Safari, Firefox, Edge).
Zet het geluid aan, een koptelefoon helpt. Druk op **Begin**.

- Beweeg of sleep over het scherm: je tekent licht en speelt belletjes mee,
  altijd in de toonsoort en op de maat.
- Spatiebalk of de knop rechtsonder pauzeert.
- Spring direct naar een beweging met `#i`, `#ii`, `#iii`, `#iv` of `#coda`
  achter de URL, of naar een maat met `#maat40`.
- In de coda typ je je eigen regel. Die wordt een sterrenbeeld en blijft in
  jouw browser bewaard voor de volgende keer.

## Bestanden

| Bestand | Wat |
| --- | --- |
| `index.html` | Het werk zelf, standalone, geen installatie nodig |
| `freestyle.html` | Dezelfde pagina als artifact-body (zonder `<html>`-skelet) |
| `build.py` | Maakt `index.html` uit `freestyle.html` |
| `media/` | Het lied als audiobestand en de clip als video, offline gerenderd uit exact dezelfde code |
| `tools/` | De scripts waarmee het lied en de clip zijn gerenderd |

## De partituur

| Onderdeel | Waarde |
| --- | --- |
| Tempo | 84 BPM, swing op de zestienden, snares iets achter de tel |
| Harmonie | D dorisch: Dm9, B♭maj9, Gm9, A7alt, één akkoord per maat |
| Vorm | 2 maten aftellen, 4 bewegingen van 18 maten (2 maten titel, 8 regels van 2 maten), 8 maten coda |
| Lengte | 82 maten, 3:54, daarna loopt de coda zacht door |

Per beweging verandert alles mee: het arrangement, de kleuren en hoe de
deeltjes bewegen.

| Beweging | Klank | Kleur |
| --- | --- | --- |
| I · Adem | Rhodes, zachte kick en rimshot, later een bas | Nachtblauw en parelwit |
| II · Stof | Volle boom bap, hi-hats, groovende bas | As, sepia, stof in zonlicht |
| III · Vuur | Zestiende hi-hats, clap, extra kicks, belletjesmotief, filter wijd open | Ossenbloed en gloeiende sintels die opstijgen |
| IV · Grootsheid | De beat trekt zich terug als het tij, pad en Rhodes, dan nog één keer alles, dan stilte | Aubergine en goud |
| Coda | Hartslag, pad, filter sluit langzaam | Dageraad aan de horizon |

## Het gedicht

**I · ADEM**

> Geen papier vannacht. Alleen mijn adem en de maat.\
> Ik tel tot vier, en wat ik nog niet weet, wordt wat ik praat.\
> De stad ligt open als een boek dat nog niemand las;\
> ik schrijf erin met één vinger, op beslagen glas.\
> Elk woord is een lucifer. Ik strijk hem langs de lucht.\
> Een tel lang ben ik vuurtoren, daarna weer gerucht.\
> Ze zeggen: grootsheid wacht op wie zich netjes heeft bereid.\
> Ik zeg: grootsheid is de sprong. De grond komt later, met de tijd.

**II · STOF**

> Wij zijn van stof dat ooit een ster was. Oud verhaal.\
> Maar stof dat ooit een ster was, kent nog steeds de taal.\
> Het weet nog hoe je brandt zonder te vragen of het mag,\
> hoe je licht geeft aan een wereld die je nooit van dichtbij zag.\
> Dus als ik happer naar een woord: dat is de oerknal, traag.\
> Elke stilte in mijn zin is een heelal dat zichzelf iets vraagt.\
> Ik ben de vonk en ook de as, het vuur en wat het achterlaat,\
> het stof dat danst in jouw raam, één middag lang, en dan weer gaat.

**III · VUUR**

> Nu zet de bas zich schrap en de vloer begint te praten,\
> de nacht klapt op de twee en vier, door alle lege straten.\
> Ik had geen plan. Een plan is een kooi met mooie tralies.\
> Ik heb een hart dat improviseert, in duizend variaties.\
> Grootsheid is geen goud, geen naam in hoge letters.\
> Het is vastlopen, en doorgaan, en dan iets veel beters.\
> Dus brand ik, brand ik, brand ik, tot de maat me niet meer houdt,\
> tot elke lettergreep een vlam is, en elke fout wordt goud.

**IV · GROOTSHEID**

> En als het stil wordt, als de beat zich terugtrekt als het tij,\
> dan blijft er iets van mij hier hangen. Iets dat zegt: ik was erbij.\
> Ik vraag geen standbeeld, geen eeuwigheid, geen naam die blijft.\
> Ik vraag alleen deze ene nacht, waarin je zonder papier schrijft.\
> Want grootsheid, hoor je, is niet groot. Het is een klein begin:\
> een mond die opengaat in het donker, met een sterrenhemel erin.\
> Dus hier. Neem het van me over. Tel tot vier. Je weet de maat.\
> Geen papier vannacht. Alleen jouw adem. En het gaat.

## Hoe het werkt

- **Klank.** Een look-ahead scheduler plant elke zestiende vooruit op de
  klok van de AudioContext. De Rhodes is FM-synthese (een modulator op
  verhouding 1 plus een korte "tine" op 7:1), met tremolo en auto-pan. De
  kick is een sinus met een toonhoogte-val, de snare gefilterde ruis met een
  driehoeksgolf als body. De galm is een convolver met een zelf berekende
  impulsrespons. Een kick drukt de rest van de mix even weg (ducking). Een
  compressor, zachte saturatie en een limiter maken de master af.
- **Beeld.** Een canvas met 1800 tot 4200 deeltjes in een stromingsveld.
  Voor elk sleutelwoord wordt de tekst onzichtbaar getekend en bemonsterd;
  de deeltjes veren naar die punten en ademen mee op de kick. Bij het loslaten
  kiest het stuk zeven punten van het woord die zo ver mogelijk uit elkaar
  liggen, verbindt ze tot een sterrenbeeld en hangt dat ergens vrij aan de
  hemel.
- **Synchroon.** Beeld en klank lezen dezelfde partituur. Alles wat je ziet
  (woorden, kleurwissels, pulsen op de kick) is gekoppeld aan de songtijd,
  niet aan de framerate. Daardoor kon de clip frame voor frame offline
  worden gerenderd en past hij precies op het gerenderde lied.
