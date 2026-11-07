# Data audit

Leads for the review in [data-review.md](../data-review.md), made by `npm run audit` (scripts/audit.mjs). Each is a place to look, not a proven mistake: most relabels, for instance, are real changes of regime.

Wikidata checks: off. Run `node scripts/fetch-wikidata-facts.mjs` where Wikidata can be reached to turn them on.

| Kind | Before 500 | 500 to 999 | 1000 to 1499 | 1500 to 1799 | 1800 to 1899 | 1900 to today | All |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Another realm's land under this name | 21 | 19 | 24 | 23 | 30 | 46 | 163 |
| Wikidata item shared with another realm | 33 | 19 | 23 | 9 | 8 | 13 | 105 |
| Not a state (party, army, people) | 2 | 1 |  |  | 5 | 13 | 21 |
| Missing from the map for some years | 41 | 55 | 75 | 36 | 37 | 20 | 264 |
| Shape shrinks or grows for a year or two | 4 |  |  | 4 | 1 | 1 | 10 |
| Centre jumps far away | 15 | 5 | 8 | 58 | 28 | 33 | 147 |
| **All** | 116 | 99 | 130 | 130 | 109 | 126 | 710 |

## Before 500

### Europe

- **low** · Another realm's land under this name: Greek Dark Ages becomes Greek City-States in 800 BCE with the same outline
- **medium** · Wikidata item shared with another realm: Q175881 is the item of Roman Republic (500 BCE to 32 BCE), Revolutionary Roman Republic (1799)
- **medium** · Missing from the map for some years: Peloponnesian League is not drawn 480 BCE to 451 BCE (30 years), then comes back
- **medium** · Not a state (party, army, people): Athenian Coalition (323 BCE to 257 BCE) reads like a party, army or people
- **medium** · Wikidata item shared with another realm: Q237325 is the item of Antigonid Macedonia (277 BCE to 165 BCE), Antigonid Dynasty (291 BCE to 278 BCE)
- **low** · Shape shrinks or grows for a year or two: Antigonid Macedonia is 44% of its size in 272 BCE, then back
- **high** · Another realm's land under this name: Greek Colonies's outline is named Greek City-States from 225 BCE; Greek City-States was last drawn 1088 km away (272 BCE)
- **low** · Centre jumps far away: Greek City-States's centre moves 1547 km in 197 BCE
- **low** · Centre jumps far away: Roman Republic's centre moves 2147 km in 126 BCE
- **medium** · Missing from the map for some years: Cimmerian Bosporus is not drawn 91 BCE to 64 BCE (28 years), then comes back
- **medium** · Wikidata item shared with another realm: Q12544 is the item of Roman Empire (31 BCE to 394), Eastern Roman Empire (395 to 1453)
- **medium** · Missing from the map for some years: Cimmerian Bosporus is not drawn 68 to 77 (10 years), then comes back
- **medium** · Wikidata item shared with another realm: Q45813 is the item of Hunnic Empire (426 to 673), Huns (106 to 425)
- **medium** · Not a state (party, army, people): Huns (106 to 425) reads like a party, army or people
- **medium** · Wikidata item shared with another realm: Q13590051 is the item of Burgundian Kingdom (414 to 660), Burgundians (154 to 409)
- **low** · Centre jumps far away: Roman Empire's centre moves 2117 km in 270
- **low** · Centre jumps far away: Roman Empire's centre moves 3317 km in 283
- **low** · Centre jumps far away: Vandals's centre moves 1508 km in 410
- **low** · Another realm's land under this name: Visigoths becomes Visigothic Kingdom in 426 with the same outline
- **medium** · Wikidata item shared with another realm: Q849967 is the item of Brythons (439 to 1235), Brythonic Kingdoms (439 to 1284)
- **medium** · Missing from the map for some years: Burgundian Kingdom is not drawn 439 to 442 (4 years), then comes back
- **low** · Shape shrinks or grows for a year or two: Visigothic Kingdom is 774% of its size in 458, then back
- **medium** · Wikidata item shared with another realm: Q146246 is the item of Kingdom of the Franks (462 to 849), Merovingian Empire (710 to 717), Carolingian Empire (718 to 723)
- **low** · Another realm's land under this name: Thuringian states becomes Kingdom of Thuringia in 476 with the same outline

### Asia

- **medium** · Missing from the map for some years: Babylonia is not drawn 1220 BCE to 1201 BCE (20 years), then comes back
- **medium** · Wikidata item shared with another realm: Q555994 is the item of Aq Qoyunlu (1407 to 1511), Lu (750 BCE to 248 BCE)
- **medium** · Wikidata item shared with another realm: Q204077 is the item of Cao Cao (197 to 223), Cao (750 BCE to 451 BCE)
- **medium** · Wikidata item shared with another realm: Q274488 is the item of Eastern Wu (207 to 282), Wu (750 BCE to 451 BCE)
- **medium** · Wikidata item shared with another realm: Q1471995 is the item of Former Qin (353 to 393), Qin (750 BCE to 219 BCE)
- **medium** · Wikidata item shared with another realm: Q1472004 is the item of Former Yan (337 to 370), Yan (750 BCE to 204 BCE)
- **medium** · Wikidata item shared with another realm: Q6201794 is the item of Jin (750 BCE to 405 BCE), Former Jin (922 to 925)
- **medium** · Wikidata item shared with another realm: Q1143524 is the item of Northern Qi (555 to 576), Qi (750 BCE to 204 BCE)
- **medium** · Wikidata item shared with another realm: Q7462 is the item of Northern Song (961 to 1138), Southern Song (1139 to 1278), Song (750 BCE to 285 BCE)
- **medium** · Missing from the map for some years: Babylonia is not drawn 630 BCE to 616 BCE (15 years), then comes back
- **medium** · Missing from the map for some years: Elam is not drawn 630 BCE to 616 BCE (15 years), then comes back
- **medium** · Wikidata item shared with another realm: Q1936158 is the item of Minyue (333 BCE to 111 BCE), Yue (500 BCE to 334 BCE)
- **low** · Another realm's land under this name: Janapada of Magadha becomes Magadha - Haryanka dynasty in 500 BCE with the same outline
- **low** · Another realm's land under this name: Janapada of Vajji becomes Mahajanapadas in 480 BCE with the same outline
- **medium** · Wikidata item shared with another realm: Q320930 is the item of Cao Wei (224 to 264), Wei (404 BCE to 204 BCE)
- **medium** · Wikidata item shared with another realm: Q1574107 is the item of Former Zhao (306 to 336), Zhao (404 BCE to 226 BCE)
- **medium** · Wikidata item shared with another realm: Q1968654 is the item of Han (404 BCE to 203 BCE), Beylik of Saruhan (1314 to 1414)
- **low** · Shape shrinks or grows for a year or two: Macedonian Empire is 268% of its size in 333 BCE to 332 BCE, then back
- **low** · Centre jumps far away: Ptolemaic Kingdom's centre moves 2201 km in 326 BCE
- **medium** · Missing from the map for some years: Ptolemaic Kingdom is not drawn 323 BCE to 308 BCE (16 years), then comes back
- **low** · Centre jumps far away: Macedonian Empire's centre moves 2995 km in 323 BCE
- **low** · Another realm's land under this name: Nanda Empire becomes Maurya Empire in 321 BCE with the same outline
- **low** · Another realm's land under this name: Perdiccas becomes Seleucid Empire in 318 BCE with the same outline
- **medium** · Missing from the map for some years: Seleucid Empire is not drawn 315 BCE to 308 BCE (8 years), then comes back
- **low** · Centre jumps far away: Ptolemaic Kingdom's centre moves 2197 km in 307 BCE
- **low** · Centre jumps far away: Macedonian Empire's centre moves 1906 km in 301 BCE
- **medium** · Missing from the map for some years: Han is not drawn 230 BCE to 209 BCE (22 years), then comes back
- **medium** · Missing from the map for some years: Wei is not drawn 222 BCE to 209 BCE (14 years), then comes back
- **medium** · Missing from the map for some years: Yan is not drawn 222 BCE to 209 BCE (14 years), then comes back
- **medium** · Missing from the map for some years: Qi is not drawn 218 BCE to 207 BCE (12 years), then comes back
- **medium** · Wikidata item shared with another realm: Q7183 is the item of Qin Dynasty (218 BCE to 209 BCE), Zhai (208 BCE to 204 BCE)
- **low** · Another realm's land under this name: Qin becomes Qin Dynasty in 218 BCE with the same outline
- **medium** · Missing from the map for some years: Kingdom of Armenia is not drawn 210 BCE to 209 BCE (2 years), then comes back
- **medium** · Wikidata item shared with another realm: Q5349053 is the item of Eighteen Kingdoms (208 BCE to 204 BCE), Linjiang (206 BCE to 204 BCE), Jibei (208 BCE to 204 BCE), Jiujiang (206 BCE to 204 BCE), Hán (206 BCE to 204 BCE), Liaodong (206 BCE to 204 BCE), Yong (206 BCE to 204 BCE), Dai (208 BCE to 204 BCE), Jiaodong (206 BCE to 204 BCE), Henan (206 BCE to 204 BCE), Chang-shan (206 BCE to 204 BCE), Sai (206 BCE to 204 BCE), Yin (206 BCE to 204 BCE)
- **medium** · Wikidata item shared with another realm: Q188836 is the item of Xiongnu (208 BCE to 153), Southern Xiongnu (51 to 105)
- **medium** · Missing from the map for some years: Kingdom of Armenia is not drawn 206 BCE to 189 BCE (18 years), then comes back
- **medium** · Wikidata item shared with another realm: Q1068371 is the item of Han Dynasty (202 BCE to 237), Chauhan Dynasty (980 to 1201)
- **medium** · Wikidata item shared with another realm: Q28405 is the item of Joseon (1395 to 1897), Gojoseon (197 BCE to 92 BCE)
- **medium** · Wikidata item shared with another realm: Q43048 is the item of Rhodes (188 BCE to 165 BCE), Domain of Rhodes (1206 to 1249)
- **medium** · Missing from the map for some years: Satavahana Dynasty is not drawn 170 BCE to 165 BCE (6 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Bithynia is not drawn 87 BCE to 78 BCE (10 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Cappadocia is not drawn 87 BCE to 78 BCE (10 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Sophene is not drawn 87 BCE to 64 BCE (24 years), then comes back
- **medium** · Missing from the map for some years: Indo-Greeks is not drawn 77 BCE to 51 BCE (27 years), then comes back
- **medium** · Missing from the map for some years: Seleucid Empire is not drawn 77 BCE to 67 BCE (11 years), then comes back
- **medium** · Missing from the map for some years: Minaeans is not drawn 66 BCE to 37 BCE (30 years), then comes back
- **medium** · Missing from the map for some years: Sabaeans is not drawn 66 BCE to 37 BCE (30 years), then comes back
- **low** · Another realm's land under this name: Shunga Empire becomes Kanva Dynasty in 66 BCE with the same outline
- **medium** · Wikidata item shared with another realm: Q136884 is the item of Lazica (63 BCE to 545), Kingdom of Lazica (638 to 777)
- **low** · Shape shrinks or grows for a year or two: Ptolemaic Kingdom is 225% of its size in 31 BCE, then back
- **high** · Another realm's land under this name: Minaeans's outline is named Himyarite Kingdom from 25 BCE; Himyarite Kingdom was last drawn 806 km away (31 BCE to 26 BCE)
- **medium** · Missing from the map for some years: Nabataeans is not drawn 25 BCE to 20 BCE (6 years), then comes back
- **low** · Centre jumps far away: Han Dynasty's centre moves 2517 km in 6
- **medium** · Missing from the map for some years: Han Dynasty is not drawn 14 to 29 (16 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Commagene is not drawn 23 to 42 (20 years), then comes back
- **low** · Centre jumps far away: Han Dynasty's centre moves 3023 km in 30
- **medium** · Wikidata item shared with another realm: Q25979 is the item of Kushan Empire (43 to 237), Eastern Kushans (238 to 346), Western Kushans (238 to 259)
- **low** · Another realm's land under this name: Yuezhi becomes Kushan Empire in 43 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Armenia is not drawn 60 to 67 (8 years), then comes back
- **low** · Centre jumps far away: Xiongnu's centre moves 1613 km in 106
- **medium** · Missing from the map for some years: Kingdom of Gordyene is not drawn 114 to 126 (13 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Osroene is not drawn 114 to 126 (13 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Adiabene is not drawn 117 to 126 (10 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Armenia is not drawn 161 to 164 (4 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Osroene is not drawn 161 to 164 (4 years), then comes back
- **medium** · Wikidata item shared with another realm: Q1661685 is the item of Sasanian Empire (215 to 643), Indo-Sasanian Empire (260 to 357)
- **medium** · Missing from the map for some years: Caucasian Albania is not drawn 260 to 286 (27 years), then comes back
- **medium** · Missing from the map for some years: Caucasian Iberia is not drawn 260 to 286 (27 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Adiabene is not drawn 260 to 286 (27 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Armenia is not drawn 260 to 286 (27 years), then comes back
- **low** · Another realm's land under this name: Western Kushans becomes Indo-Sasanian Empire in 260 with the same outline
- **low** · Another realm's land under this name: Cao Wei becomes Western Jin in 265 with the same outline
- **low** · Another realm's land under this name: Former Zhao becomes Later Zhao in 337 with the same outline
- **low** · Another realm's land under this name: Mahan becomes Baekje in 347 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Armenia is not drawn 371 to 386 (16 years), then comes back
- **low** · Another realm's land under this name: Jinhan becomes Silla in 378 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Armenia is not drawn 396 to 401 (6 years), then comes back
- **medium** · Missing from the map for some years: Western Qin is not drawn 402 to 409 (8 years), then comes back
- **medium** · Wikidata item shared with another realm: Q4186404 is the item of Western Liang (407 to 409), Later Western Liang (561 to 586)
- **medium** · Wikidata item shared with another realm: Q7427 is the item of Western Xia (990 to 1226), Xia (410 to 438)
- **low** · Another realm's land under this name: Later Yan becomes Northern Yan in 410 with the same outline
- **low** · Another realm's land under this name: Western Jin becomes Liu Song Dynasty in 426 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Armenia is not drawn 439 to 450 (12 years), then comes back
- **low** · Another realm's land under this name: Liu Song Dynasty becomes Southern Qi in 480 with the same outline

### Africa

- **low** · Another realm's land under this name: Early Dynastic Period of Egypt becomes Old Kingdom of Egypt in 2500 BCE with the same outline
- **medium** · Wikidata item shared with another realm: Q41642 is the item of Phoenicia (1150 BCE to 501 BCE), Phoenician Empire (1150 BCE to 501 BCE)
- **low** · Centre jumps far away: Phoenicia's centre moves 2051 km in 675 BCE
- **low** · Centre jumps far away: Phoenicia's centre moves 2051 km in 615 BCE
- **low** · Centre jumps far away: Phoenicia's centre moves 2480 km in 530 BCE
- **medium** · Missing from the map for some years: Cyrenaica is not drawn 291 BCE to 273 BCE (19 years), then comes back
- **medium** · Wikidata item shared with another realm: Q829356 is the item of Makuria Kingdom (1415 to 1518), Makuria (347 to 1414)

### North America

- **medium** · Wikidata item shared with another realm: Q28567 is the item of Mayan City-States (247 BCE to 849), Later Mayan City-States (850 to 1546)

## 500 to 999

### Europe

- **medium** · Wikidata item shared with another realm: Q4492881 is the item of Frisia Kingdom (612 to 717), Frisia (783 to 787)
- **medium** · Missing from the map for some years: Kingdom of Bernicia is not drawn 612 to 632 (21 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Deira is not drawn 612 to 632 (21 years), then comes back
- **medium** · Missing from the map for some years: Burgundian Kingdom is not drawn 617 to 643 (27 years), then comes back
- **medium** · Missing from the map for some years: Frisia Kingdom is not drawn 617 to 643 (27 years), then comes back
- **medium** · Missing from the map for some years: Hunnic Empire is not drawn 630 to 632 (3 years), then comes back
- **medium** · Missing from the map for some years: Aquitaine is not drawn 633 to 660 (28 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Thuringia is not drawn 633 to 640 (8 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Northumbria is not drawn 633 (1 year), then comes back
- **medium** · Missing from the map for some years: Kingdom of Mercia is not drawn 656 to 660 (5 years), then comes back
- **medium** · Missing from the map for some years: Wihtgar is not drawn 661 to 665 (5 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Kent is not drawn 692 to 704 (13 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Sussex is not drawn 692 to 717 (26 years), then comes back
- **medium** · Missing from the map for some years: Aquitaine is not drawn 732 to 749 (18 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Wessex is not drawn 741 to 754 (14 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Benevento is not drawn 750 to 774 (25 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Spoleto is not drawn 750 to 774 (25 years), then comes back
- **low** · Another realm's land under this name: Umayyad Caliphate becomes Emirate of Córdoba in 757 with the same outline
- **medium** · Wikidata item shared with another realm: Q1311990 is the item of Principality of Serbia (768 to 961), Grand Principality of Serbia (1094 to 1168), Serbia (1918)
- **medium** · Missing from the map for some years: Duchy of Benevento is not drawn 788 to 792 (5 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Wessex is not drawn 788 to 805 (18 years), then comes back
- **medium** · Missing from the map for some years: Saxons is not drawn 788 to 792 (5 years), then comes back
- **medium** · Wikidata item shared with another realm: Q200262 is the item of Kingdom of Navarre (1139 to 1428), Kingdom of Pamplona (825 to 865)
- **low** · Another realm's land under this name: Breton Kingdoms becomes Kingdom of Brittany in 825 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Mercia is not drawn 830 to 839 (10 years), then comes back
- **low** · Another realm's land under this name: Kingdom of Sobrarbe becomes County of Aragon in 830 with the same outline
- **low** · Centre jumps far away: Viking settlements's centre moves 2543 km in 840
- **medium** · Wikidata item shared with another realm: Q33242 is the item of Kingdom of Lower Burgundy (900 to 935), Lower Burgundy (860 to 925)
- **medium** · Missing from the map for some years: Kingdom of Powys is not drawn 860 to 877 (18 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Spoleto is not drawn 866 to 874 (9 years), then comes back
- **medium** · Missing from the map for some years: Principality of Capua is not drawn 866 to 874 (9 years), then comes back
- **low** · Another realm's land under this name: Kingdom of Pamplona becomes County of Ribagorza in 866 with the same outline
- **medium** · Missing from the map for some years: Lower Burgundy is not drawn 870 to 879 (10 years), then comes back
- **low** · Centre jumps far away: Viking settlements's centre moves 1705 km in 878
- **medium** · Wikidata item shared with another realm: Q1108445 is the item of Kievan Rus' (882 to 1240), Rus' (880 to 881)
- **medium** · Missing from the map for some years: East Franks is not drawn 882 to 886 (5 years), then comes back
- **medium** · Wikidata item shared with another realm: Q33235 is the item of Upper Burgundy and Italy (922 to 925), Upper Burgundy (887 to 959)
- **medium** · Missing from the map for some years: Duchy of Spoleto is not drawn 888 to 897 (10 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Italy is not drawn 896 to 897 (2 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Mercia is not drawn 898 (1 year), then comes back
- **medium** · Missing from the map for some years: Kingdom of Italy is not drawn 900 to 910 (11 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Powys is not drawn 900 to 910 (11 years), then comes back
- **medium** · Missing from the map for some years: Lower Burgundy is not drawn 900 to 910 (11 years), then comes back
- **low** · Another realm's land under this name: Dál Riata becomes Kingdom of Alba in 900 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Lower Burgundy is not drawn 911 to 925 (15 years), then comes back
- **medium** · Missing from the map for some years: County of Besalú is not drawn 922 to 935 (14 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Italy is not drawn 922 to 935 (14 years), then comes back
- **medium** · Missing from the map for some years: Upper Burgundy is not drawn 922 to 925 (4 years), then comes back
- **low** · Centre jumps far away: Viking settlements's centre moves 2096 km in 922
- **medium** · Missing from the map for some years: Principality of Serbia is not drawn 926 to 935 (10 years), then comes back
- **low** · Another realm's land under this name: Emirate of Córdoba becomes Caliphate of Córdoba in 936 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Gwent is not drawn 947 to 959 (13 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Powys is not drawn 947 to 959 (13 years), then comes back
- **high** · Another realm's land under this name: Kingdom of Seisyllwg's outline is named Brythons from 960; Brythons was last drawn 302 km away (947 to 959)
- **medium** · Missing from the map for some years: County of Berga is not drawn 960 to 989 (30 years), then comes back
- **medium** · Missing from the map for some years: County of Urgell is not drawn 960 (1 year), then comes back
- **medium** · Wikidata item shared with another realm: Q12548 is the item of Holy Roman Empire (962 to 1621), Holy Roman Empire Minor States (1260 to 1806)
- **low** · Another realm's land under this name: Kingdom of Germany becomes Holy Roman Empire in 962 with the same outline
- **medium** · Missing from the map for some years: County of Urgell is not drawn 970 to 999 (30 years), then comes back
- **medium** · Missing from the map for some years: Principality of Salerno is not drawn 980 to 989 (10 years), then comes back
- **medium** · Wikidata item shared with another realm: Q207162 is the item of Bourbon Kingdom of France (1814 to 1830), Kingdom of France (990 to 1791)

### Asia

- **medium** · Wikidata item shared with another realm: Q783489 is the item of Liang Dynasty (510 to 560), Later Liang Dynasty (911 to 925)
- **low** · Another realm's land under this name: Southern Qi becomes Liang Dynasty in 510 with the same outline
- **medium** · Wikidata item shared with another realm: Q1057118 is the item of Chenla (555 to 717), Water Chenla (718 to 805), Land Chenla (718 to 805)
- **low** · Another realm's land under this name: Eastern Wei becomes Northern Qi in 555 with the same outline
- **low** · Another realm's land under this name: Western Wei becomes Northern Zhou in 561 with the same outline
- **medium** · Wikidata item shared with another realm: Q205466 is the item of Western Göktürks (587 to 660), Eastern Göktürks (587 to 632)
- **medium** · Wikidata item shared with another realm: Q844910 is the item of Pandya Empire (1216 to 1325), Pandya Dynasty (592 to 921)
- **medium** · Missing from the map for some years: Lakhmid Kingdom is not drawn 602 to 628 (27 years), then comes back
- **medium** · Missing from the map for some years: Ghassanids is not drawn 617 to 628 (12 years), then comes back
- **low** · Another realm's land under this name: Eastern Roman Empire becomes Byzantine Empire in 633 with the same outline
- **medium** · Wikidata item shared with another realm: Q2118293 is the item of Turks (666 to 756), Oghuz Turks (750 to 1055)
- **medium** · Wikidata item shared with another realm: Q229 is the item of Cyprus Condominium (692 to 959), Republic of Cyprus (1961 to 2024)
- **low** · Centre jumps far away: Umayyad Caliphate's centre moves 1756 km in 692
- **low** · Another realm's land under this name: Asuka Japan becomes Nara Japan in 710 with the same outline
- **medium** · Missing from the map for some years: Galuh Kingdom is not drawn 724 to 740 (17 years), then comes back
- **medium** · Wikidata item shared with another realm: Q12536 is the item of Abbasid Caliphate (750 to 1259), Buyid Dynasty (936 to 1055), Abbasid Caliphate/Buyid Dynasty (947 to 969)
- **low** · Centre jumps far away: Umayyad Caliphate's centre moves 4451 km in 751
- **medium** · Missing from the map for some years: Yenisei Kyrgyz is not drawn 763 to 792 (30 years), then comes back
- **low** · Another realm's land under this name: Nara Japan becomes Heian Japan in 793 with the same outline
- **medium** · Missing from the map for some years: Shirvan is not drawn 840 to 865 (26 years), then comes back
- **medium** · Wikidata item shared with another realm: Q494354 is the item of Kara-Khanids (850 to 1045), Eastern Kara-Khanids (1046 to 1138), Western Karakhanid Khanate (1046 to 1084)
- **medium** · Not a state (party, army, people): Tibetans (850 to 1259) reads like a party, army or people
- **medium** · Missing from the map for some years: Cyprus Condominium is not drawn 875 to 883 (9 years), then comes back
- **medium** · Missing from the map for some years: Zaydi Alid dynasties is not drawn 892 to 895 (4 years), then comes back
- **medium** · Missing from the map for some years: Zaydi Alid dynasties is not drawn 911 to 921 (11 years), then comes back
- **medium** · Wikidata item shared with another realm: Q12491027 is the item of Balinese Kingdom (1519 to 1686), Early Balinese Kingdoms (922 to 1343)
- **medium** · Missing from the map for some years: Later Jin is not drawn 922 to 935 (14 years), then comes back
- **low** · Another realm's land under this name: Taebong becomes Goryeo in 922 with the same outline
- **low** · Another realm's land under this name: Zaydi Alid dynasties becomes Ziyarid dynasty in 936 with the same outline
- **medium** · Missing from the map for some years: Buyid Dynasty is not drawn 947 to 969 (23 years), then comes back
- **low** · Another realm's land under this name: Later Jin becomes Later Han in 947 with the same outline
- **low** · Another realm's land under this name: Later Zhou becomes Northern Song in 961 with the same outline

### Africa

- **medium** · Missing from the map for some years: Kharijites is not drawn 755 to 756 (2 years), then comes back
- **high** · Another realm's land under this name: Fihrids's outline is named Kharijites from 757; Kharijites was last drawn 680 km away (751 to 754)
- **medium** · Missing from the map for some years: Idrisids is not drawn 922 to 925 (4 years), then comes back
- **medium** · Missing from the map for some years: Idrisids is not drawn 936 to 946 (11 years), then comes back

### North America

- **medium** · Wikidata item shared with another realm: Q478805 is the item of Puebloans - Chaco Regional System (850 to 1151), Puebloans - Aztec Regional System (1152 to 1304)

### South America

- **medium** · Wikidata item shared with another realm: Q581741 is the item of Chimu Empire (1188 to 1481), Chimor (911 to 1187)

## 1000 to 1499

### Europe

- **low** · Centre jumps far away: Viking settlements's centre moves 2396 km in 1000
- **medium** · Missing from the map for some years: Principality of Capua is not drawn 1010 to 1014 (5 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of England is not drawn 1018 to 1045 (28 years), then comes back
- **medium** · Missing from the map for some years: Taifa of Niebla is not drawn 1018 to 1027 (10 years), then comes back
- **medium** · Missing from the map for some years: County of Barcelona is not drawn 1028 to 1039 (12 years), then comes back
- **medium** · Missing from the map for some years: County of Berga is not drawn 1028 to 1039 (12 years), then comes back
- **medium** · Missing from the map for some years: County of Champagne is not drawn 1028 to 1039 (12 years), then comes back
- **medium** · Missing from the map for some years: County of Osona is not drawn 1028 to 1039 (12 years), then comes back
- **medium** · Missing from the map for some years: County of Urgell is not drawn 1028 to 1039 (12 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Naples is not drawn 1028 to 1033 (6 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Aragon is not drawn 1028 to 1039 (12 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Castile is not drawn 1028 to 1039 (12 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of León is not drawn 1034 to 1039 (6 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Galicia is not drawn 1040 to 1065 (26 years), then comes back
- **medium** · Missing from the map for some years: Principality of Capua is not drawn 1040 to 1055 (16 years), then comes back
- **medium** · Missing from the map for some years: Taifa of Almería is not drawn 1040 to 1045 (6 years), then comes back
- **medium** · Wikidata item shared with another realm: Q62651 is the item of Denmark-Norway (1526 to 1940), Norway-Denmark (1046 to 1055)
- **medium** · Missing from the map for some years: Duchy of Benevento is not drawn 1046 to 1055 (10 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of León is not drawn 1046 to 1065 (20 years), then comes back
- **medium** · Missing from the map for some years: Old Kingdom of Norway is not drawn 1046 to 1055 (10 years), then comes back
- **medium** · Missing from the map for some years: County of Maine is not drawn 1056 to 1065 (10 years), then comes back
- **medium** · Wikidata item shared with another realm: Q239502 is the item of Halych-Volhynia occupation (1056 to 1240), Principality of Galicia-Volhynia (1202 to 1240), Galicia-Volhynia (1294 to 1351)
- **medium** · Missing from the map for some years: Kingdom of Brycheiniog is not drawn 1056 to 1065 (10 years), then comes back
- **medium** · Wikidata item shared with another realm: Q1252942 is the item of Kingdom of Duklja (1072 to 1138), Great Principality of Duklja (1056 to 1071)
- **medium** · Wikidata item shared with another realm: Q83546 is the item of Principality of Rostov-Suzdal (1056 to 1240), Principality of Vladimir-Suzdal (1294 to 1486)
- **medium** · Missing from the map for some years: County of Champagne is not drawn 1066 to 1093 (28 years), then comes back
- **medium** · Missing from the map for some years: Giudicato of Logudoro is not drawn 1066 to 1071 (6 years), then comes back
- **medium** · Missing from the map for some years: Taifa of Algeciras is not drawn 1066 to 1084 (19 years), then comes back
- **medium** · Missing from the map for some years: Taifa of Tortosa is not drawn 1066 to 1084 (19 years), then comes back
- **medium** · Missing from the map for some years: Taifa of Valencia is not drawn 1066 to 1084 (19 years), then comes back
- **medium** · Wikidata item shared with another realm: Q459188 is the item of Kingdom of the Isles (1085 to 1176), Kingdom of Mann (1177 to 1271)
- **medium** · Missing from the map for some years: Kingdom of Gwynedd is not drawn 1094 to 1098 (5 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Powys is not drawn 1094 to 1098 (5 years), then comes back
- **medium** · Wikidata item shared with another realm: Q269109 is the item of Principality of Ryazan (1094 to 1240), Ryazan (1453 to 1520)
- **medium** · Missing from the map for some years: County of Champagne is not drawn 1126 to 1151 (26 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Castile is not drawn 1126 to 1138 (13 years), then comes back
- **medium** · Missing from the map for some years: Taifa of Dénia is not drawn 1126 to 1146 (21 years), then comes back
- **medium** · Wikidata item shared with another realm: Q568638 is the item of Duchy of Silesia (1139 to 1304), Duchy of Wrocław (1169 to 1201)
- **medium** · Missing from the map for some years: Kingdom of León is not drawn 1139 to 1168 (30 years), then comes back
- **low** · Another realm's land under this name: Norman Italy becomes Kingdom of Sicily in 1139 with the same outline
- **medium** · Missing from the map for some years: Duchy of Silesia is not drawn 1147 to 1168 (22 years), then comes back
- **medium** · Missing from the map for some years: County of Vermandois is not drawn 1169 to 1187 (19 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Sandomierz is not drawn 1169 to 1176 (8 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Brittany is not drawn 1188 to 1205 (18 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Masovia is not drawn 1188 to 1201 (14 years), then comes back
- **medium** · Missing from the map for some years: Principality of Halych is not drawn 1188 to 1191 (4 years), then comes back
- **medium** · Wikidata item shared with another realm: Q671362 is the item of Principality of Turov and Pinsk (1188 to 1240), Principality of Pinsk (1294 to 1325), Principality of Turov (1294 to 1325)
- **low** · Another realm's land under this name: Angevin Empire's outline is named Kingdom of England from 1210; Kingdom of England was drawn nearby before (936 to 1071)
- **medium** · Missing from the map for some years: County of Toulouse is not drawn 1216 to 1219 (4 years), then comes back
- **medium** · Missing from the map for some years: County of Toulouse is not drawn 1227 to 1235 (9 years), then comes back
- **medium** · Missing from the map for some years: County of Boulogne is not drawn 1236 to 1240 (5 years), then comes back
- **medium** · Wikidata item shared with another realm: Q939200 is the item of Capetian House of Anjou (1250 to 1384), House of Anjou-Sicily (1272 to 1384)
- **medium** · Missing from the map for some years: Principality of Minsk is not drawn 1250 to 1259 (10 years), then comes back
- **medium** · Wikidata item shared with another realm: Q148499 is the item of Margraviate of Brandenburg (1260 to 1414), Electorate of Brandenburg (1422 to 1618)
- **medium** · Missing from the map for some years: County of Nevers is not drawn 1272 to 1284 (13 years), then comes back
- **medium** · Missing from the map for some years: Principality of Achaea is not drawn 1279 to 1293 (15 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Sicily is not drawn 1285 to 1304 (20 years), then comes back
- **low** · Another realm's land under this name: Kingdom of Alba becomes Kingdom of Scotland in 1294 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Scotland is not drawn 1305 to 1313 (9 years), then comes back
- **low** · Another realm's land under this name: Duchy of Athens becomes Catalan Company in 1314 with the same outline
- **medium** · Missing from the map for some years: Duchy of Bavaria is not drawn 1326 to 1351 (26 years), then comes back
- **low** · Centre jumps far away: Viking settlements's centre moves 2925 km in 1326
- **medium** · Wikidata item shared with another realm: Q7245121 is the item of Principality of Valona and Kanina (1395 to 1421), Principality of Valona (1333 to 1374)
- **low** · Another realm's land under this name: Earldom of Ulster becomes Earldom of Desmond in 1333 with the same outline
- **medium** · Missing from the map for some years: County of Auvergne is not drawn 1352 to 1362 (11 years), then comes back
- **medium** · Missing from the map for some years: County of Armagnac is not drawn 1363 to 1374 (12 years), then comes back
- **medium** · Missing from the map for some years: County of Périgord is not drawn 1363 to 1384 (22 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Aquitaine is not drawn 1363 to 1374 (12 years), then comes back
- **low** · Another realm's land under this name: Banate of Bosnia becomes Kingdom of Bosnia in 1385 with the same outline
- **medium** · Missing from the map for some years: Blue Horde is not drawn 1395 to 1401 (7 years), then comes back
- **medium** · Missing from the map for some years: County of Ampuria is not drawn 1395 to 1401 (7 years), then comes back
- **medium** · Wikidata item shared with another realm: Q194355 is the item of House of Jagiellon (1450 to 1571), Polish-Lithuania Kingdom (1395 to 1449)
- **medium** · Missing from the map for some years: Duchy of Brittany is not drawn 1429 to 1439 (11 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Lorraine is not drawn 1440 to 1452 (13 years), then comes back
- **low** · Centre jumps far away: Republic of Genoa's centre moves 1523 km in 1440
- **medium** · Missing from the map for some years: Duchy of Milan is not drawn 1450 to 1452 (3 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Hungary is not drawn 1450 to 1458 (9 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Naples is not drawn 1450 to 1458 (9 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Bohemia is not drawn 1453 to 1458 (6 years), then comes back
- **low** · Another realm's land under this name: Ambrosian Republic's outline is named Duchy of Milan from 1453; Duchy of Milan was drawn nearby before (1402 to 1449)
- **medium** · Missing from the map for some years: Duchy of Lorraine is not drawn 1475 to 1481 (7 years), then comes back
- **low** · Another realm's land under this name: House of Ascania's outline is named Electorate of Saxony from 1487; Electorate of Saxony was drawn nearby before (1363 to 1428)

### Asia

- **low** · Another realm's land under this name: Utpala Dynasty becomes Lohara Dynasty in 1003 with the same outline
- **medium** · Missing from the map for some years: Lavo Kingdom is not drawn 1028 to 1055 (28 years), then comes back
- **medium** · Missing from the map for some years: Ziyadid dynasty is not drawn 1066 to 1071 (6 years), then comes back
- **medium** · Missing from the map for some years: Khwarezmid Dynasty is not drawn 1147 to 1151 (5 years), then comes back
- **low** · Another realm's land under this name: Najahid Dynasty becomes Nabhani Dynasty in 1169 with the same outline
- **medium** · Missing from the map for some years: Ghaznavid Empire is not drawn 1192 to 1201 (10 years), then comes back
- **medium** · Missing from the map for some years: Chámpa is not drawn 1206 to 1219 (14 years), then comes back
- **low** · Centre jumps far away: Hamdanid Emirates's centre moves 2277 km in 1210
- **low** · Centre jumps far away: Hamdanid Emirates's centre moves 2467 km in 1216
- **low** · Centre jumps far away: Hamdanid Emirates's centre moves 2364 km in 1220
- **low** · Another realm's land under this name: Kediri Kingdom becomes Singhasari in 1227 with the same outline
- **medium** · Wikidata item shared with another realm: Q918153 is the item of Ceylon (1236 to 1506), British Ceylon (1796 to 1814)
- **low** · Another realm's land under this name: Hamdanid Emirates becomes Bahrani Dynasty in 1260 with the same outline
- **medium** · Wikidata item shared with another realm: Q7313 is the item of Yuan Dynasty (1271 to 1368), Great Mongol State (1912 to 1925)
- **high** · Another realm's land under this name: Nicaean Empire's outline is named Byzantine Empire from 1279; Byzantine Empire was last drawn 683 km away (1206 to 1226)
- **medium** · Wikidata item shared with another realm: Q1059707 is the item of Lan Na Kingdom (1294 to 1563), Lan Na (1600 to 1761)
- **medium** · Wikidata item shared with another realm: Q1479726 is the item of Malaya (1294 to 1351), Federation of Malaya (1958 to 1962)
- **medium** · Wikidata item shared with another realm: Q2096678 is the item of Beylik of Isfendiyar (1305 to 1462), Beylik of Sinop (1305 to 1332)
- **low** · Another realm's land under this name: Myinsaing Kingdom becomes Kingdom of Pinya in 1314 with the same outline
- **low** · Another realm's land under this name: Kamakura Shogunate becomes Kenmu Restoration in 1333 with the same outline
- **low** · Another realm's land under this name: Kenmu Restoration becomes Ashikaga Shogunate in 1344 with the same outline
- **low** · Another realm's land under this name: Kashmir becomes Kashmiri Sultanate in 1344 with the same outline
- **medium** · Missing from the map for some years: Samudera Pasai Sultanate is not drawn 1352 to 1362 (11 years), then comes back
- **medium** · Missing from the map for some years: Golden Horde is not drawn 1363 to 1384 (22 years), then comes back
- **medium** · Missing from the map for some years: Shirvan is not drawn 1385 to 1414 (30 years), then comes back
- **low** · Another realm's land under this name: Goryeo becomes Joseon in 1395 with the same outline
- **medium** · Missing from the map for some years: Byzantine Empire is not drawn 1402 to 1406 (5 years), then comes back
- **medium** · Wikidata item shared with another realm: Q4332415 is the item of Four Oirats (1402 to 1474), Oirat Confederation (1619 to 1676)
- **medium** · Missing from the map for some years: Qara Qoyunlu is not drawn 1402 to 1406 (5 years), then comes back
- **low** · Another realm's land under this name: Tughlaq Dynasty becomes Sayyid Dynasty in 1415 with the same outline
- **low** · Another realm's land under this name: Chüzan becomes Ryukyu Kingdom in 1429 with the same outline
- **medium** · Wikidata item shared with another realm: Q631210 is the item of Nogai Horde (1450 to 1563), Small Horde (1564 to 1737)
- **medium** · Missing from the map for some years: Sukhothai Kingdom is not drawn 1450 to 1452 (3 years), then comes back
- **low** · Another realm's land under this name: Rasulid Dynasty becomes Tahirid Sultanate in 1459 with the same outline
- **medium** · Wikidata item shared with another realm: Q840601 is the item of East Turkestan (1463 to 1474), East Turkestan Republic (1945 to 1949)
- **medium** · Missing from the map for some years: Kingdom of Georgia is not drawn 1463 to 1467 (5 years), then comes back
- **medium** · Wikidata item shared with another realm: Q1191125 is the item of Moghulistan (1463 to 1518), Eastern Moghulistan (1519 to 1686), Eastern Chagatai Khanate (1492 to 1511), Western Moghulistan (1519 to 1635)

### Africa

- **medium** · Wikidata item shared with another realm: Q1139762 is the item of Bornu Empire (1385 to 1894), Empire of Kanem (1072 to 1384)
- **low** · Centre jumps far away: Almoravid Dynasty's centre moves 1529 km in 1139
- **medium** · Missing from the map for some years: Zengid dynasty is not drawn 1192 to 1201 (10 years), then comes back
- **low** · Another realm's land under this name: Ghana Empire becomes Sosso Empire in 1202 with the same outline
- **medium** · Missing from the map for some years: Makuria is not drawn 1279 to 1293 (15 years), then comes back
- **medium** · Missing from the map for some years: Zayyanid dynasty is not drawn 1344 to 1362 (19 years), then comes back
- **medium** · Missing from the map for some years: Hafsid Dynasty is not drawn 1352 to 1362 (11 years), then comes back
- **medium** · Wikidata item shared with another realm: Q2365048 is the item of Adal Sultanate (1415 to 1546), Sultanate of Harar (1547 to 1578)
- **low** · Another realm's land under this name: Marinid Sultanate becomes Wattasid dynasty in 1468 with the same outline

### South America

- **low** · Another realm's land under this name: Cuzco becomes Inca Empire in 1440 with the same outline
- **low** · Centre jumps far away: Inca Empire's centre moves 1581 km in 1497

## 1500 to 1799

### Europe

- **medium** · Missing from the map for some years: Duchy of Milan is not drawn 1502 to 1525 (24 years), then comes back
- **medium** · Missing from the map for some years: Habsburg Monarchy is not drawn 1507 to 1515 (9 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Sweden is not drawn 1521 to 1525 (5 years), then comes back
- **low** · Another realm's land under this name: Teutonic Order becomes Duchy of Prussia in 1526 with the same outline
- **low** · Another realm's land under this name: House of Jagiellon becomes Polish-Lithuanian Commonwealth in 1572 with the same outline
- **medium** · Missing from the map for some years: Principality of Transylvania is not drawn 1600 to 1601 (2 years), then comes back
- **medium** · Missing from the map for some years: Principality of Wallachia is not drawn 1600 to 1601 (2 years), then comes back
- **low** · Shape shrinks or grows for a year or two: Principality of Moldavia is 315% of its size in 1600 to 1601, then back
- **medium** · Missing from the map for some years: Electorate of Saxony is not drawn 1632 to 1635 (4 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Lorraine is not drawn 1636 to 1647 (12 years), then comes back
- **high** · Another realm's land under this name: Don Cossacks's outline is named Astrakhan Khanate from 1642; Astrakhan Khanate was last drawn 446 km away (1502 to 1555)
- **medium** · Wikidata item shared with another realm: Q235 is the item of Principality of Monaco (1642 to 2024), Kingdom of Monaco (1815 to 1939)
- **medium** · Missing from the map for some years: Kingdom of England is not drawn 1653 to 1661 (9 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Scotland is not drawn 1653 to 1660 (8 years), then comes back
- **high** · Another realm's land under this name: Commonwealth of England's outline is named Kingdom of England from 1662; Kingdom of England was last drawn 405 km away (1648 to 1652)
- **medium** · Missing from the map for some years: Duchy of Lorraine is not drawn 1673 to 1699 (27 years), then comes back
- **medium** · Missing from the map for some years: Brandenburg-Prussia is not drawn 1702 to 1717 (16 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Lorraine is not drawn 1702 to 1712 (11 years), then comes back
- **high** · Another realm's land under this name: Pro-Swedish Poland's outline is named Polish-Lithuanian Commonwealth from 1713; Polish-Lithuanian Commonwealth was last drawn 881 km away (1709 to 1712)
- **low** · Centre jumps far away: Brandenburg-Prussia's centre moves 5555 km in 1718
- **medium** · Missing from the map for some years: Duchy of Lorraine is not drawn 1734 to 1747 (14 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Lorraine is not drawn 1757 to 1762 (6 years), then comes back
- **low** · Shape shrinks or grows for a year or two: Kingdom of Prussia is 37% of its size in 1762, then back
- **medium** · Missing from the map for some years: Duchy of Bavaria is not drawn 1778 to 1779 (2 years), then comes back
- **low** · Shape shrinks or grows for a year or two: Principality of Moldavia is 12% of its size in 1791, then back
- **low** · Shape shrinks or grows for a year or two: Principality of Wallachia is 23% of its size in 1791, then back
- **low** · Another realm's land under this name: Kingdom of France becomes French First Republic in 1792 with the same outline
- **medium** · Missing from the map for some years: Principality of Monaco is not drawn 1794 to 1813 (20 years), then comes back
- **low** · Another realm's land under this name: French First Republic becomes French Directory in 1796 with the same outline
- **medium** · Missing from the map for some years: Grand Duchy of Tuscany is not drawn 1799 (1 year), then comes back
- **medium** · Missing from the map for some years: Papal States is not drawn 1799 (1 year), then comes back
- **medium** · Missing from the map for some years: Swiss Confederation is not drawn 1799 to 1814 (16 years), then comes back

### Asia

- **high** · Another realm's land under this name: Kapisa's outline is named Timurid Empire from 1507; Timurid Empire was last drawn 722 km away (1502 to 1506)
- **medium** · Missing from the map for some years: Sultanate of Sulu is not drawn 1507 to 1528 (22 years), then comes back
- **low** · Centre jumps far away: Ottoman Empire's centre moves 1561 km in 1519
- **medium** · Missing from the map for some years: Lê Dynasty is not drawn 1529 to 1533 (5 years), then comes back
- **low** · Centre jumps far away: Golden Horde's centre moves 4786 km in 1547
- **low** · Another realm's land under this name: Grand Principality of Moscow becomes Tsardom of Russia in 1547 with the same outline
- **low** · Centre jumps far away: Sultanate of Malacca's centre moves 1591 km in 1552
- **medium** · Missing from the map for some years: Ayutthaya Kingdom is not drawn 1572 to 1587 (16 years), then comes back
- **medium** · Missing from the map for some years: Lan Xang is not drawn 1579 to 1587 (9 years), then comes back
- **low** · Centre jumps far away: Portuguese Colonies's centre moves 1549 km in 1582
- **low** · Another realm's land under this name: Kingdom of Pajana becomes Mataram Sultanate in 1588 with the same outline
- **medium** · Missing from the map for some years: Sultanate of Maguindanao is not drawn 1609 to 1611 (3 years), then comes back
- **low** · Centre jumps far away: Sultanate of Malacca's centre moves 1743 km in 1640
- **low** · Centre jumps far away: Dutch Republic's centre moves 9513 km in 1642
- **medium** · Wikidata item shared with another realm: Q1794655 is the item of Kutai Kingdom (1648 to 1733), Sultanate of Kutai Kartanegara (1734 to 1845)
- **medium** · Missing from the map for some years: Southern Ming is not drawn 1659 to 1661 (3 years), then comes back
- **low** · Centre jumps far away: Dutch Republic's centre moves 9511 km in 1662
- **low** · Centre jumps far away: Portuguese Colonies's centre moves 5380 km in 1662
- **low** · Centre jumps far away: Southern Ming's centre moves 2079 km in 1662
- **low** · Centre jumps far away: Dutch Republic's centre moves 12518 km in 1673
- **low** · Centre jumps far away: French India's centre moves 1522 km in 1674
- **high** · Another realm's land under this name: Oirat Confederation's outline is named Dzungar Khanate from 1677; Dzungar Khanate was last drawn 323 km away (1609 to 1618)
- **medium** · Missing from the map for some years: Mataram Sultanate is not drawn 1677 to 1682 (6 years), then comes back
- **low** · Centre jumps far away: Dutch Republic's centre moves 12516 km in 1677
- **low** · Centre jumps far away: Sultanate of Malacca's centre moves 1696 km in 1677
- **low** · Another realm's land under this name: Nayaks of Thanjavur becomes Thanjavur Maratha Kingdom in 1677 with the same outline
- **low** · Centre jumps far away: Dutch Republic's centre moves 11473 km in 1683
- **low** · Centre jumps far away: Sultanate of Malacca's centre moves 1696 km in 1683
- **low** · Another realm's land under this name: Balinese Kingdom becomes Bali in 1687 with the same outline
- **low** · Another realm's land under this name: Portuguese Ceylon becomes Dutch Ceylon in 1687 with the same outline
- **medium** · Missing from the map for some years: Maratha Empire is not drawn 1691 to 1717 (27 years), then comes back
- **low** · Centre jumps far away: French India's centre moves 1522 km in 1693
- **low** · Centre jumps far away: French India's centre moves 1522 km in 1699
- **medium** · Wikidata item shared with another realm: Q424 is the item of Kingdom of Cambodia (1956 to 2024), Cambodia (1700 to 1802)
- **low** · Centre jumps far away: Portuguese Colonies's centre moves 6042 km in 1706
- **low** · Another realm's land under this name: Kingdom of England becomes Kingdom of Great Britain in 1709 with the same outline
- **low** · Centre jumps far away: Portuguese Colonies's centre moves 6042 km in 1718
- **low** · Another realm's land under this name: Tsardom of Russia becomes Russian Empire in 1721 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Georgia is not drawn 1738 to 1743 (6 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Kakheti is not drawn 1738 to 1743 (6 years), then comes back
- **low** · Centre jumps far away: Yarubid dynasty's centre moves 3864 km in 1741
- **medium** · Wikidata item shared with another realm: Q398 is the item of Bahrain (1757 to 1845), Kingdom of Bahrain (1973 to 2024)
- **medium** · Wikidata item shared with another realm: Q817 is the item of Kuwait (1757 to 2024), State of Kuwait (1961 to 1989)
- **medium** · Missing from the map for some years: Sikh Confederacy is not drawn 1763 to 1768 (6 years), then comes back
- **low** · Another realm's land under this name: Ayutthaya Kingdom becomes Thonburi Kingdom in 1769 with the same outline
- **low** · Another realm's land under this name: Thonburi Kingdom becomes Rattanakosin Kingdom in 1783 with the same outline
- **low** · Another realm's land under this name: Khanate of Bukhara becomes Emirate of Bukhara in 1788 with the same outline
- **medium** · Missing from the map for some years: French India is not drawn 1793 to 1815 (23 years), then comes back
- **low** · Another realm's land under this name: Dutch Ceylon becomes British Ceylon in 1796 with the same outline

### Africa

- **low** · Centre jumps far away: Portuguese Africa's centre moves 3724 km in 1547
- **low** · Another realm's land under this name: Wattasid dynasty becomes Saadi Sultanate in 1556 with the same outline
- **medium** · Wikidata item shared with another realm: Q4807130 is the item of Dutch Cape Colony (1653 to 1795), Napoleonic Batavia Republic (1803 to 1805)
- **medium** · Missing from the map for some years: Bamana Empire is not drawn 1757 to 1765 (9 years), then comes back
- **low** · Another realm's land under this name: Nawabs of Bengal's outline is named British Empire from 1762; British Empire was drawn nearby before (1757 to 1761)
- **low** · Another realm's land under this name: Dutch Cape Colony becomes British Cape Colony in 1796 with the same outline

### North America

- **low** · Centre jumps far away: New France's centre moves 6116 km in 1612
- **low** · Centre jumps far away: English Colonial Empire's centre moves 2223 km in 1619
- **low** · Centre jumps far away: New France's centre moves 6116 km in 1626
- **low** · Centre jumps far away: New France's centre moves 3284 km in 1629
- **low** · Centre jumps far away: New France's centre moves 3115 km in 1632
- **low** · Centre jumps far away: English Colonial Empire's centre moves 1515 km in 1640
- **low** · Centre jumps far away: English Colonial Empire's centre moves 4327 km in 1653
- **low** · Centre jumps far away: English Colonial Empire's centre moves 4326 km in 1670
- **low** · Centre jumps far away: New France's centre moves 4983 km in 1670
- **low** · Centre jumps far away: New France's centre moves 4978 km in 1673
- **medium** · Missing from the map for some years: English Colonial Empire is not drawn 1709 to 1712 (4 years), then comes back
- **low** · Centre jumps far away: English Colonial Empire's centre moves 13570 km in 1713
- **low** · Centre jumps far away: New France's centre moves 2281 km in 1721
- **low** · Centre jumps far away: New France's centre moves 2460 km in 1734
- **medium** · Missing from the map for some years: English Colonial Empire is not drawn 1762 (1 year), then comes back
- **low** · Centre jumps far away: New France's centre moves 2459 km in 1762
- **low** · Centre jumps far away: New France's centre moves 2166 km in 1763
- **low** · Centre jumps far away: New France's centre moves 3458 km in 1791
- **medium** · Wikidata item shared with another realm: Q2006756 is the item of Empire of Haiti (1805 to 1915), Haiti (1792 to 1802)

### South America

- **medium** · Wikidata item shared with another realm: Q200464 is the item of Portuguese Empire (1502 to 1823), Portuguese Colonies (1564 to 1910)
- **medium** · Missing from the map for some years: Spanish Empire is not drawn 1519 to 1520 (2 years), then comes back
- **low** · Centre jumps far away: Spanish Empire's centre moves 2035 km in 1521
- **low** · Centre jumps far away: Spanish Empire's centre moves 4584 km in 1540
- **low** · Centre jumps far away: Spanish Empire's centre moves 2013 km in 1547
- **low** · Centre jumps far away: Spanish Empire's centre moves 1900 km in 1572
- **low** · Centre jumps far away: Portuguese Empire's centre moves 2997 km in 1619
- **medium** · Missing from the map for some years: Portuguese Empire is not drawn 1622 to 1639 (18 years), then comes back
- **low** · Centre jumps far away: New Netherland's centre moves 4174 km in 1626
- **low** · Centre jumps far away: New Netherland's centre moves 4218 km in 1629
- **low** · Centre jumps far away: New Netherland's centre moves 2868 km in 1636
- **low** · Centre jumps far away: Portuguese Empire's centre moves 1830 km in 1642
- **low** · Centre jumps far away: Portuguese Empire's centre moves 1830 km in 1645
- **low** · Centre jumps far away: New Netherland's centre moves 6607 km in 1648
- **low** · Centre jumps far away: Portuguese Empire's centre moves 1729 km in 1648
- **low** · Centre jumps far away: New Netherland's centre moves 4302 km in 1670
- **low** · Centre jumps far away: Spanish Empire's centre moves 3131 km in 1687

### Oceania

- **medium** · Wikidata item shared with another realm: Q8680 is the item of British Colonial Empire (1706 to 1999), British Empire (1607 to 1997)
- **low** · Centre jumps far away: British Colonial Empire's centre moves 5907 km in 1709
- **low** · Centre jumps far away: British Colonial Empire's centre moves 2455 km in 1776
- **low** · Centre jumps far away: British Colonial Empire's centre moves 2455 km in 1778
- **low** · Centre jumps far away: British Colonial Empire's centre moves 2069 km in 1780
- **low** · Centre jumps far away: British Colonial Empire's centre moves 2069 km in 1781
- **low** · Centre jumps far away: British Colonial Empire's centre moves 16546 km in 1788

## 1800 to 1899

### Europe

- **medium** · Missing from the map for some years: Ligurian Republic is not drawn 1800 to 1802 (3 years), then comes back
- **medium** · Wikidata item shared with another realm: Q38 is the item of Republic of Italy (1946 to 2024), Italian Republic (1803 to 1813)
- **low** · Another realm's land under this name: Electorate of Hanover becomes Kingdom of Hanover in 1803 with the same outline
- **medium** · Wikidata item shared with another realm: Q71084 is the item of First French Empire (1805 to 1814), First French colonial empire (1805 to 1814)
- **medium** · Missing from the map for some years: Kingdom of Hanover is not drawn 1805 to 1813 (9 years), then comes back
- **medium** · Missing from the map for some years: Ligurian Republic is not drawn 1805 to 1813 (9 years), then comes back
- **medium** · Not a state (party, army, people): Serbs (1805 to 1915) reads like a party, army or people
- **medium** · Missing from the map for some years: Electorate of Hesse is not drawn 1806 to 1813 (8 years), then comes back
- **low** · Another realm's land under this name: Habsburg Monarchy becomes Austrian Empire in 1806 with the same outline
- **low** · Another realm's land under this name: Electorate of Saxony becomes Kingdom of Saxony in 1806 with the same outline
- **medium** · Missing from the map for some years: Free City of Bremen is not drawn 1807 to 1813 (7 years), then comes back
- **low** · Shape shrinks or grows for a year or two: Grand Duchy of Saxe-Weimar-Eisenach is 50% of its size in 1807 to 1808, then back
- **medium** · Missing from the map for some years: Kingdom of Prussia is not drawn 1809 to 1813 (5 years), then comes back
- **medium** · Missing from the map for some years: Duchy of Oldenburg is not drawn 1811 to 1813 (3 years), then comes back
- **medium** · Missing from the map for some years: French Mascarene Islands is not drawn 1811 to 1814 (4 years), then comes back
- **medium** · Missing from the map for some years: Papal States is not drawn 1811 to 1813 (3 years), then comes back
- **medium** · Missing from the map for some years: Grand Duchy of Tuscany is not drawn 1814 (1 year), then comes back
- **medium** · Missing from the map for some years: Serbs is not drawn 1814 (1 year), then comes back
- **low** · Another realm's land under this name: Grand Duchy of Würzburg's outline is named Electorate of Hesse from 1815; Electorate of Hesse was drawn nearby before (1803 to 1814)
- **low** · Another realm's land under this name: Kingdom of Naples (Napoleonic) becomes Kingdom of the Two Sicilies in 1815 with the same outline
- **low** · Another realm's land under this name: Helvetic Republic's outline is named Swiss Confederation from 1815; Swiss Confederation was drawn nearby before (1294 to 1798)
- **medium** · Missing from the map for some years: Duchy of Modena and Reggio is not drawn 1848 (1 year), then comes back
- **medium** · Missing from the map for some years: Duchy of Parma and Piacenza is not drawn 1848 (1 year), then comes back
- **medium** · Not a state (party, army, people): Italian Nationalists (1848) reads like a party, army or people
- **medium** · Missing from the map for some years: Kingdom of Prussia is not drawn 1848 to 1862 (15 years), then comes back
- **low** · Another realm's land under this name: Bourbon Kingdom of France becomes French Second Republic in 1848 with the same outline
- **medium** · Wikidata item shared with another realm: Q28513 is the item of Austria-Hungary (1868 to 1918), Hungarian Nationalists (1849 to 1957)
- **medium** · Missing from the map for some years: Grand Duchy of Baden is not drawn 1849 to 1852 (4 years), then comes back
- **medium** · Not a state (party, army, people): Hungarian Nationalists (1849 to 1957) reads like a party, army or people
- **low** · Another realm's land under this name: French Second Republic becomes Second French Empire in 1853 with the same outline
- **low** · Another realm's land under this name: Kingdom of Sardinia's outline is named Kingdom of Italy from 1862; Kingdom of Italy was drawn nearby before (587 to 969)
- **medium** · Missing from the map for some years: Grand Duchy of Hesse is not drawn 1866 to 1867 (2 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Saxony is not drawn 1866 to 1867 (2 years), then comes back
- **low** · Another realm's land under this name: Austrian Empire becomes Austria-Hungary in 1868 with the same outline
- **medium** · Missing from the map for some years: Kingdom of Spain is not drawn 1873 to 1876 (4 years), then comes back
- **low** · Another realm's land under this name: First Spanish Republic's outline is named Kingdom of Spain from 1877; Kingdom of Spain was drawn nearby before (1516 to 1872)
- **medium** · Missing from the map for some years: Serbs is not drawn 1880 to 1884 (5 years), then comes back
- **low** · Another realm's land under this name: Kingdom of Serbia's outline is named Serbs from 1885; Serbs was drawn nearby before (1805 to 1879)

### Asia

- **medium** · Missing from the map for some years: House of Khalifa is not drawn 1800 to 1802 (3 years), then comes back
- **low** · Centre jumps far away: Batavian Republic's centre moves 11788 km in 1800
- **low** · Centre jumps far away: Danish India's centre moves 1808 km in 1800
- **low** · Centre jumps far away: Danish India's centre moves 1565 km in 1803
- **medium** · Wikidata item shared with another realm: Q836 is the item of Burma (1820 to 1989), Union of Myanmar (1990 to 2024)
- **medium** · Wikidata item shared with another realm: Q846 is the item of Qatar Dynasty (1820 to 1904), Qatar (1913 to 1915), State of Qatar (1973 to 2024)
- **low** · Another realm's land under this name: Konbaung Dynasty becomes Burma in 1820 with the same outline
- **medium** · Missing from the map for some years: Sultanate of Kedah is not drawn 1822 to 1841 (20 years), then comes back
- **medium** · Missing from the map for some years: Emirate of Jabal Shammar is not drawn 1828 to 1839 (12 years), then comes back
- **low** · Another realm's land under this name: Durrani Empire becomes Emirate of Afghanistan in 1828 with the same outline
- **medium** · Missing from the map for some years: Bahrain is not drawn 1830 to 1839 (10 years), then comes back
- **medium** · Missing from the map for some years: Emirate of Afghanistan is not drawn 1840 to 1845 (6 years), then comes back
- **medium** · Missing from the map for some years: Emirate of Jabal Shammar is not drawn 1846 to 1865 (20 years), then comes back
- **low** · Another realm's land under this name: Durrani Dynasty's outline is named Emirate of Afghanistan from 1846; Emirate of Afghanistan was drawn nearby before (1828 to 1839)
- **medium** · Missing from the map for some years: Trucial States is not drawn 1853 to 1855 (3 years), then comes back
- **low** · Centre jumps far away: Dutch East Indies's centre moves 3939 km in 1873
- **low** · Centre jumps far away: Kingdom of Great Britain's centre moves 6114 km in 1890
- **medium** · Missing from the map for some years: Emirate of Nejd is not drawn 1895 to 1904 (10 years), then comes back
- **low** · Centre jumps far away: Dutch East Indies's centre moves 9594 km in 1895
- **low** · Centre jumps far away: Qajar Dynasty's centre moves 7214 km in 1895
- **low** · Centre jumps far away: Dutch East Indies's centre moves 7214 km in 1898
- **low** · Another realm's land under this name: Joseon becomes Korean Empire in 1898 with the same outline
- **low** · Centre jumps far away: Qajar Dynasty's centre moves 7214 km in 1898

### Africa

- **low** · Centre jumps far away: British Cape Colony's centre moves 5873 km in 1803
- **high** · Another realm's land under this name: Napoleonic Batavia Republic's outline is named British Cape Colony from 1806; British Cape Colony was last drawn 5873 km away (1805)
- **low** · Centre jumps far away: British Cape Colony's centre moves 5873 km in 1806
- **low** · Centre jumps far away: Omani Slave Coast's centre moves 2449 km in 1840
- **high** · Another realm's land under this name: French Algeria's outline is named French Africa from 1848; French Africa was last drawn 4121 km away (1846 to 1847)
- **low** · Centre jumps far away: French Africa's centre moves 4121 km in 1848
- **low** · Another realm's land under this name: Muhammad Ali dynasty becomes Khedivate of Egypt in 1866 with the same outline
- **low** · Another realm's land under this name: Second French Empire becomes French Third Republic in 1871 with the same outline
- **low** · Another realm's land under this name: Kamerun becomes German Africa in 1871 with the same outline
- **low** · Another realm's land under this name: Dutch Gold Coast becomes British Gold Coast in 1873 with the same outline
- **medium** · Missing from the map for some years: South African Republic is not drawn 1877 to 1884 (8 years), then comes back
- **medium** · Wikidata item shared with another realm: Q1050 is the item of Eswatini (1969 to 2024), Swaziland (1885 to 1907)
- **low** · Centre jumps far away: French Africa's centre moves 2831 km in 1885
- **low** · Centre jumps far away: German Africa's centre moves 3057 km in 1885
- **low** · Centre jumps far away: Kingdom of Portugal's centre moves 6297 km in 1885
- **low** · Centre jumps far away: British Africa's centre moves 4857 km in 1890
- **medium** · Missing from the map for some years: Swaziland is not drawn 1895 to 1899 (5 years), then comes back
- **low** · Centre jumps far away: French Africa's centre moves 3347 km in 1895
- **low** · Centre jumps far away: German Africa's centre moves 2583 km in 1895

### North America

- **low** · Centre jumps far away: French Louisiana's centre moves 2320 km in 1803
- **medium** · Missing from the map for some years: Republic of Nicaragua is not drawn 1856 (1 year), then comes back
- **low** · Centre jumps far away: Republic of Baja California's centre moves 3393 km in 1856
- **low** · Another realm's land under this name: Republic of Baja California's outline is named Republic of Nicaragua from 1857; Republic of Nicaragua was drawn nearby before (1840 to 1855)
- **medium** · Missing from the map for some years: Dominican Republic is not drawn 1861 to 1864 (4 years), then comes back
- **low** · Centre jumps far away: Federated Republic of Mexico's centre moves 1679 km in 1865
- **low** · Another realm's land under this name: Second Mexican Empire becomes Mexico in 1868 with the same outline
- **low** · Centre jumps far away: Canada's centre moves 2044 km in 1870
- **medium** · Not a state (party, army, people): Cuban Nationalists (1895 to 1899) reads like a party, army or people
- **low** · Another realm's land under this name: Kingdom of Hawaï'i becomes Republic of Hawai'i in 1895 with the same outline

### South America

- **medium** · Wikidata item shared with another realm: Q717 is the item of Venezuela (1834 to 2024), Republic of Venezuela (1811 to 1814)
- **medium** · Not a state (party, army, people): Guayaquil Junta (1812 to 1813) reads like a party, army or people
- **medium** · Missing from the map for some years: Republic of Venezuela is not drawn 1812 to 1813 (2 years), then comes back
- **medium** · Missing from the map for some years: Republic of Chile is not drawn 1815 to 1819 (5 years), then comes back
- **low** · Centre jumps far away: Netherlands Antilles's centre moves 1679 km in 1820
- **low** · Centre jumps far away: Portuguese Empire's centre moves 9229 km in 1822
- **low** · Centre jumps far away: Spanish Empire's centre moves 4700 km in 1824
- **low** · Another realm's land under this name: Río de la Plata becomes Argentine Confederation in 1834 with the same outline
- **medium** · Missing from the map for some years: Bolivia is not drawn 1836 to 1839 (4 years), then comes back
- **medium** · Missing from the map for some years: Republic of Peru is not drawn 1836 to 1839 (4 years), then comes back
- **low** · Another realm's land under this name: Republic of New Granada becomes Granadine Confederation in 1859 with the same outline
- **low** · Another realm's land under this name: Granadine Confederation becomes United States of Colombia in 1863 with the same outline
- **low** · Another realm's land under this name: United States of Colombia becomes Republic of Colombia in 1866 with the same outline
- **medium** · Missing from the map for some years: Paraguay is not drawn 1870 to 1876 (7 years), then comes back
- **medium** · Missing from the map for some years: Spanish Empire is not drawn 1873 to 1876 (4 years), then comes back
- **low** · Centre jumps far away: Spanish Empire's centre moves 15845 km in 1877
- **low** · Centre jumps far away: Republic of Chile's centre moves 1587 km in 1885
- **medium** · Wikidata item shared with another realm: Q155 is the item of Brazilian Republic (1890 to 1966), Unitary State of Brazil (1937 to 1945), Federated Republic of Brazil (1967 to 1986), Republic of Brazil (1987 to 2024)
- **low** · Another realm's land under this name: Empire of Brazil becomes Brazilian Republic in 1890 with the same outline

## 1900 to today

### Europe

- **medium** · Wikidata item shared with another realm: Q222 is the item of Albania (1912 to 1945), Republic of Albania (1991 to 2024)
- **low** · Centre jumps far away: Denmark-Norway's centre moves 1796 km in 1918
- **medium** · Wikidata item shared with another realm: Q191 is the item of Estonia (1919 to 1939), Republic of Estonia (1992 to 2024)
- **medium** · Wikidata item shared with another realm: Q28 is the item of Hungarian Republic (1919 to 1944), Hungary (1945 to 2024)
- **medium** · Wikidata item shared with another realm: Q40 is the item of Republic of Austria (1919 to 1937), Second Republic of Austria (1945 to 2024)
- **medium** · Wikidata item shared with another realm: Q83286 is the item of Socialist Federal Republic of Yugoslavia (1946 to 1991), Yugoslavia (1919 to 1945)
- **medium** · Not a state (party, army, people): Spanish Nationalists (1936 to 1938) reads like a party, army or people
- **low** · Another realm's land under this name: Weimar Republic becomes Nazi Germany in 1936 with the same outline
- **low** · Centre jumps far away: Second Spanish Republic's centre moves 1927 km in 1936
- **low** · Another realm's land under this name: Irish Free State becomes Éire in 1938 with the same outline
- **medium** · Missing from the map for some years: Albania is not drawn 1939 to 1943 (5 years), then comes back
- **medium** · Missing from the map for some years: Czechoslovakia is not drawn 1939 to 1944 (6 years), then comes back
- **medium** · Missing from the map for some years: Kingdom of Belgium is not drawn 1940 to 1944 (5 years), then comes back
- **medium** · Missing from the map for some years: Luxembourg is not drawn 1940 to 1944 (5 years), then comes back
- **low** · Centre jumps far away: Kingdom of Norway's centre moves 2028 km in 1940
- **medium** · Missing from the map for some years: Yugoslavia is not drawn 1941 to 1944 (4 years), then comes back
- **low** · Centre jumps far away: Kingdom of Italy's centre moves 8136 km in 1944
- **low** · Centre jumps far away: Kingdom of Italy's centre moves 8131 km in 1945
- **low** · Centre jumps far away: Kingdom of Italy's centre moves 8129 km in 1946
- **low** · Another realm's land under this name: Albania becomes People's Socialist Republic of Albania in 1946 with the same outline
- **low** · Another realm's land under this name: Kingdom of Bulgaria becomes People's Republic of Bulgaria in 1948 with the same outline
- **low** · Another realm's land under this name: Kingdom of Romania becomes Socialist Republic of Romania in 1948 with the same outline
- **medium** · Missing from the map for some years: Hungarian People's Republic is not drawn 1956 to 1957 (2 years), then comes back
- **low** · Another realm's land under this name: Hungarian Nationalists's outline is named Hungarian People's Republic from 1958; Hungarian People's Republic was drawn nearby before (1950 to 1955)
- **medium** · Not a state (party, army, people): Greek junta (1967 to 1975) reads like a party, army or people
- **low** · Another realm's land under this name: Kingdom of Greece becomes Greek junta in 1967 with the same outline
- **low** · Another realm's land under this name: Greek junta becomes Third Hellenic Republic in 1976 with the same outline
- **low** · Another realm's land under this name: Hungarian People's Republic's outline is named Hungary from 1990; Hungary was drawn nearby before (1945 to 1949)
- **low** · Another realm's land under this name: Socialist Republic of Romania becomes Romania in 1990 with the same outline
- **low** · Another realm's land under this name: People's Socialist Republic of Albania becomes Republic of Albania in 1991 with the same outline
- **low** · Another realm's land under this name: People's Republic of Bulgaria becomes Republic of Bulgaria in 1991 with the same outline
- **medium** · Missing from the map for some years: Chechen Republic is not drawn 1996 to 1999 (4 years), then comes back

### Asia

- **medium** · Missing from the map for some years: Republic of China is not drawn 1916 to 1929 (14 years), then comes back
- **medium** · Not a state (party, army, people): Kuomintang (1917 to 1929) reads like a party, army or people
- **low** · Another realm's land under this name: Russian Empire becomes Russian Republic in 1917 with the same outline
- **medium** · Wikidata item shared with another realm: Q399 is the item of Armenia (1918 to 1919), Republic of Armenia (1992 to 2024)
- **medium** · Wikidata item shared with another realm: Q227 is the item of Republic of Azerbaijan (1992 to 2024), Azerbaijan Democratic Republic (1918 to 1919)
- **medium** · Missing from the map for some years: Great Mongol State is not drawn 1920 to 1921 (2 years), then comes back
- **low** · Another realm's land under this name: Republic of Uryankhay becomes Tuvan People's Republic in 1921 with the same outline
- **low** · Another realm's land under this name: Republics of the Soviet Union becomes Union of Soviet Socialist Republics in 1922 with the same outline
- **low** · Another realm's land under this name: Qajar Dynasty becomes Pahlavi Dynasty in 1924 with the same outline
- **low** · Another realm's land under this name: Ottoman Empire becomes Republic of Turkey in 1924 with the same outline
- **low** · Another realm's land under this name: Emirate of Afghanistan becomes Kingdom of Afghanistan in 1926 with the same outline
- **low** · Another realm's land under this name: Great Mongol State becomes Mongolian People's Republic in 1926 with the same outline
- **medium** · Not a state (party, army, people): Chinese Communists (1928 to 1931) reads like a party, army or people
- **medium** · Wikidata item shared with another realm: Q17427 is the item of Communist Party of China (1932 to 1949), Chinese Communists (1928 to 1931)
- **medium** · Not a state (party, army, people): Anti-Kuomintang Coalition (1930 to 1931) reads like a party, army or people
- **low** · Another realm's land under this name: Kuomintang's outline is named Republic of China from 1930; Republic of China was drawn nearby before (1912 to 1915)
- **medium** · Not a state (party, army, people): Communist Party of China (1932 to 1949) reads like a party, army or people
- **low** · Another realm's land under this name: Rattanakosin Kingdom becomes Kingdom of Thailand in 1932 with the same outline
- **low** · Centre jumps far away: Communist Party of China's centre moves 2112 km in 1938
- **medium** · Missing from the map for some years: Netherlands is not drawn 1940 to 1944 (5 years), then comes back
- **medium** · Missing from the map for some years: Dutch East Indies is not drawn 1943 to 1945 (3 years), then comes back
- **low** · Centre jumps far away: Communist Party of China's centre moves 2096 km in 1946
- **low** · Another realm's land under this name: French Mandate for Syria and Lebanon becomes Second Syrian Republic in 1946 with the same outline
- **low** · Centre jumps far away: British Raj's centre moves 1707 km in 1947
- **low** · Another realm's land under this name: Sultanate of Muscat and Oman becomes Qatar Protectorate in 1947 with the same outline
- **low** · Another realm's land under this name: British Raj's outline is named Burma from 1948; Burma was drawn nearby before (1820 to 1884)
- **high** · Another realm's land under this name: Dutch East Indies's outline is named Republic of Indonesia from 1950; Republic of Indonesia was last drawn 1323 km away (1949)
- **medium** · Missing from the map for some years: Sultanate of Aceh is not drawn 1950 to 1952 (3 years), then comes back
- **medium** · Wikidata item shared with another realm: Q172640 is the item of Democratic Republic of Vietnam (1956 to 1975), Republic of Vietnam (1956 to 1975)
- **low** · Centre jumps far away: French Indochina's centre moves 6838 km in 1956
- **medium** · Missing from the map for some years: Kingdom of Jordan is not drawn 1958 to 1959 (2 years), then comes back
- **medium** · Wikidata item shared with another realm: Q796 is the item of Iraqi Republic (1960 to 2005), Republic of Iraq (2014 to 2024)
- **medium** · Wikidata item shared with another realm: Q858 is the item of Syria (1973 to 2024), Republic of Syria (1961 to 1962), Ba'athist Syria (1963 to 1966)
- **medium** · Not a state (party, army, people): Arab Socialist Ba'ath Party (1967 to 1972) reads like a party, army or people
- **low** · Another realm's land under this name: Ba'athist Syria becomes Arab Socialist Ba'ath Party in 1967 with the same outline
- **low** · Centre jumps far away: Kingdom of Great Britain's centre moves 6071 km in 1973
- **low** · Another realm's land under this name: Kingdom of Afghanistan becomes Republic of Afghanistan in 1973 with the same outline
- **low** · Another realm's land under this name: Arab Socialist Ba'ath Party becomes Syria in 1973 with the same outline
- **medium** · Not a state (party, army, people): Communist Laos (1976 to 2024) reads like a party, army or people
- **medium** · Missing from the map for some years: Kingdom of Cambodia is not drawn 1976 to 1995 (20 years), then comes back
- **low** · Another realm's land under this name: Kingdom of Laos becomes Communist Laos in 1976 with the same outline
- **low** · Another realm's land under this name: Pahlavi Dynasty becomes Islamic Republic of Iran in 1979 with the same outline
- **low** · Another realm's land under this name: Khmer Rouge becomes People's Republic of Kampuchea in 1979 with the same outline
- **medium** · Not a state (party, army, people): Mujahideen (1987 to 1995) reads like a party, army or people
- **medium** · Missing from the map for some years: Afghanistan is not drawn 1990 to 1995 (6 years), then comes back
- **low** · Another realm's land under this name: Mongolian People's Republic becomes Mongolia in 1992 with the same outline
- **medium** · Not a state (party, army, people): Taliban (1996 to 2005) reads like a party, army or people
- **low** · Another realm's land under this name: People's Republic of Kampuchea's outline is named Kingdom of Cambodia from 1996; Kingdom of Cambodia was drawn nearby before (1956 to 1975)

### Africa

- **low** · Centre jumps far away: British Africa's centre moves 4102 km in 1900
- **low** · Centre jumps far away: French Africa's centre moves 2235 km in 1905
- **low** · Centre jumps far away: Kingdom of Portugal's centre moves 5312 km in 1911
- **low** · Centre jumps far away: Italian Africa's centre moves 4070 km in 1912
- **low** · Another realm's land under this name: Portuguese Republic becomes Estado Novo in 1926 with the same outline
- **low** · Centre jumps far away: British Africa's centre moves 1778 km in 1930
- **low** · Centre jumps far away: Italian Africa's centre moves 3264 km in 1936
- **medium** · Not a state (party, army, people): Free French (1940 to 1944) reads like a party, army or people
- **low** · Centre jumps far away: Italian Africa's centre moves 3232 km in 1941
- **low** · Centre jumps far away: Vichy France's centre moves 7121 km in 1943
- **high** · Another realm's land under this name: Vichy France's outline is named Free French from 1944; Free French was last drawn 7745 km away (1943)
- **low** · Centre jumps far away: Free French's centre moves 7745 km in 1944
- **medium** · Wikidata item shared with another realm: Q79 is the item of Republic of Egypt (1953 to 1957), Arab Republic of Egypt (1973 to 2024)
- **low** · Another realm's land under this name: Kingdom of Egypt becomes Republic of Egypt in 1953 with the same outline
- **low** · Shape shrinks or grows for a year or two: State of Israel is 388% of its size in 1956 to 1957, then back
- **low** · Another realm's land under this name: French Africa becomes French Fifth Republic in 1958 with the same outline
- **low** · Another realm's land under this name: British Gold Coast becomes Federal Republic of Nigeria in 1961 with the same outline
- **low** · Centre jumps far away: French Fifth Republic's centre moves 2062 km in 1963
- **low** · Centre jumps far away: British East Africa's centre moves 3525 km in 1969
- **low** · Another realm's land under this name: Kingdom of Libya becomes Libyan Arab Republic in 1969 with the same outline
- **medium** · Missing from the map for some years: Democratic Republic of the Congo is not drawn 1973 to 1995 (23 years), then comes back
- **low** · Another realm's land under this name: United Arab Republic becomes Arab Republic of Egypt in 1973 with the same outline
- **low** · Another realm's land under this name: Rhodesia becomes Zimbabwe Rhodesia in 1979 with the same outline
- **low** · Another realm's land under this name: Zimbabwe Rhodesia becomes Republic of Zimbabwe in 1983 with the same outline
- **low** · Another realm's land under this name: Zaire's outline is named Democratic Republic of the Congo from 1996; Democratic Republic of the Congo was drawn nearby before (1960 to 1972)
- **low** · Another realm's land under this name: Libyan Arab Republic becomes State of Libya in 2014 with the same outline

### North America

- **medium** · Wikidata item shared with another realm: Q241 is the item of Communist Cuba (1960 to 2024), Republic of Cuba (1905 to 1959)
- **medium** · Missing from the map for some years: Republic of Cuba is not drawn 1908 to 1910 (3 years), then comes back
- **medium** · Missing from the map for some years: Dominican Republic is not drawn 1916 to 1923 (8 years), then comes back
- **low** · Centre jumps far away: Denmark's centre moves 2962 km in 1946
- **medium** · Not a state (party, army, people): Cuban Communists (1958 to 1959) reads like a party, army or people
- **medium** · Not a state (party, army, people): Communist Cuba (1960 to 2024) reads like a party, army or people
- **low** · Centre jumps far away: Denmark's centre moves 2962 km in 1979

### South America

- **low** · Another realm's land under this name: Argentine Confederation becomes Argentine Republic in 1930 with the same outline
- **medium** · Missing from the map for some years: Brazilian Republic is not drawn 1932 to 1945 (14 years), then comes back
- **low** · Centre jumps far away: Netherlands Antilles's centre moves 1679 km in 1976

### Oceania

- **low** · Centre jumps far away: British Colonial Empire's centre moves 16563 km in 1901
- **low** · Centre jumps far away: British Colonial Empire's centre moves 14331 km in 1907
- **medium** · Missing from the map for some years: Guam is not drawn 1942 to 1943 (2 years), then comes back
- **low** · Centre jumps far away: British Colonial Empire's centre moves 17435 km in 1946
- **low** · Centre jumps far away: British Colonial Empire's centre moves 18840 km in 1947
- **low** · Centre jumps far away: British Colonial Empire's centre moves 18840 km in 1963
- **low** · Centre jumps far away: British Colonial Empire's centre moves 3506 km in 1967
- **low** · Centre jumps far away: British Colonial Empire's centre moves 16492 km in 1983
- **low** · Another realm's land under this name: New Hebrides becomes Vanuatu in 1983 with the same outline
- **low** · Centre jumps far away: British Colonial Empire's centre moves 13901 km in 1984
