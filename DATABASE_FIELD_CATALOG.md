# CivicWatch Database Field Catalog

Generated from the live PostgreSQL database on 2026-07-01T20:50:04.118Z.

## Database Source

- Database: `civicwatch`
- User: `postgres`
- Host: `localhost:5432`
- PostgreSQL: `PostgreSQL 17.6 on x86_64-windows, compiled by msvc-19.44.35213, 64-bit`

## Relation Inventory

| Schema | Relation | Type | Rows | Size |
|---|---|---:|---:|---:|
| `public` | `legislators` | Base table | 5,927 exact | 2.8 MB |
| `public` | `posts` | Base table | 22,190,944 estimated | 8.8 GB |
| `public` | `topics` | Base table | 22 exact | 32.0 KB |
| `public` | `topic_engagement_daily` | Materialized view | 27,790 exact | 2.5 MB |
| `public` | `topic_party_breakdown` | Materialized view | 66 exact | 24.0 KB |
| `public` | `topic_state_breakdown` | Materialized view | 1,100 exact | 144.0 KB |
| `public` | `legislator_summary` | View | computed | 0 B |
| `public` | `posts_id_seq` | Sequence | n/a | 8.0 KB |

## public.legislators

- Type: Base table
- Rows: exact 5,927
- Total relation size: 2.8 MB

### Fields

| # | Field | Type | Nullable | Default / Generated | Constraints | Example contents |
|---:|---|---|---|---|---|---|
| 1 | `lid` | `text` | No |  | PK: legislators_pkey | `861436278755033088`<br>`444464812`<br>`40045792`<br>`15917926`<br>`118854018` |
| 2 | `name` | `text` | No |  |  | `@riggs4missouri`<br>`ken king`<br>`joe gruters`<br>`shannon erickson`<br>`shannon grove` |
| 3 | `handle` | `text` | Yes |  |  | `riggs4missouri`<br>`KingForTexas`<br>`JoeGruters`<br>`shannonerickson1`<br>`shannongrove` |
| 4 | `state` | `text` | Yes |  |  | `TX`<br>`FL`<br>`SC`<br>`CA`<br>`LA` |
| 5 | `chamber` | `text` | Yes |  | CHECK: CHECK (chamber IS NULL OR (chamber = ANY (ARRAY['H'::text, 'S'::text]))) | `H`<br>`S` |
| 6 | `party` | `text` | Yes |  | CHECK: CHECK (party IS NULL OR (party = ANY (ARRAY['Democratic'::text, 'Republican'::text, 'Independent'::text, 'Other'::text]))) | `Republican`<br>`Democratic`<br>`Independent` |
| 7 | `official_id` | `text` | Yes |  |  | `kingken1`<br>`grutersjoe1`<br>`ericksonshannon1`<br>`groveshannon1`<br>`hewittsharon1` |
| 8 | `author_id2` | `text` | Yes |  |  | `15974312`<br>`1054112732`<br>`41859804`<br>`62847703`<br>`2350717808` |
| 9 | `firstname` | `text` | Yes |  |  | `Ken`<br>`Joe`<br>`Shannon`<br>`Sharon`<br>`shavonda e.` |
| 10 | `lastname` | `text` | Yes |  |  | `King`<br>`Gruters`<br>`Erickson`<br>`Grove`<br>`Hewitt` |
| 11 | `gender` | `text` | Yes |  |  | `M`<br>`F` |
| 12 | `race` | `text` | Yes |  |  | `White`<br>`Black`<br>`Latino`<br>`Native American`<br>`Asian American` |
| 13 | `district_num` | `text` | Yes |  |  | `88`<br>`23`<br>`124`<br>`16`<br>`1` |
| 14 | `district_num_sld` | `text` | Yes |  |  | `88`<br>`23`<br>`124`<br>`16`<br>`1` |
| 15 | `district_name` | `text` | Yes |  |  | `Texas House of Representatives District 88`<br>`Florida State Senate District 22`<br>`South Carolina House of Representatives District 124`<br>`California State Senate District 12`<br>`NaN` |
| 16 | `district_type` | `text` | Yes |  |  | `State Legislative (Lower)`<br>`State Legislative (Upper)`<br>`NaN`<br>`State`<br>`Congress` |
| 17 | `district_ocdid` | `text` | Yes |  |  | `ocd-division/country:us/state:tx/sldl:88`<br>`ocd-division/country:us/state:fl/sldu:22`<br>`ocd-division/country:us/state:sc/sldl:124`<br>`ocd-division/country:us/state:ca/sldu:12`<br>`NaN` |
| 18 | `yr_elected` | `integer` | Yes |  |  | `2013`<br>`2018`<br>`2006`<br>`2016`<br>`2012` |
| 19 | `yr_left_office` | `integer` | Yes |  |  | `2020`<br>`2021`<br>`2022`<br>`2019` |
| 20 | `vote_pct` | `double precision` | Yes |  |  | `100`<br>`57.7`<br>`63.2`<br>`64.2`<br>`34.5` |
| 21 | `yr_vote` | `integer` | Yes |  |  | `2020`<br>`2018`<br>`2019`<br>`2021`<br>`2022` |
| 22 | `bp_url` | `text` | Yes |  |  | `https://ballotpedia.org/Ken_King`<br>`https://ballotpedia.org/Joe_Gruters`<br>`https://ballotpedia.org/Shannon_Erickson`<br>`https://ballotpedia.org/Shannon_Grove`<br>`https://ballotpedia.org/Sharon_Hewitt` |
| 23 | `state_fips` | `text` | Yes |  |  | `48`<br>`12`<br>`45`<br>`6`<br>`22` |
| 24 | `sld_fips` | `text` | Yes |  |  | `48088`<br>`12023`<br>`45124`<br>`6016`<br>`22001` |
| 25 | `state_full` | `text` | Yes |  |  | `TX`<br>`FL`<br>`SC`<br>`CA`<br>`NaN` |
| 26 | `office_name` | `text` | Yes |  |  | `Texas House of Representatives District 88`<br>`Florida State Senate District 22`<br>`South Carolina House of Representatives District 124`<br>`California State Senate District 12`<br>`NaN` |
| 27 | `office_level` | `text` | Yes |  |  | `State`<br>`NaN`<br>`Federal`<br>`Local` |
| 28 | `office_branch` | `text` | Yes |  |  | `Legislative`<br>`NaN`<br>`Executive`<br>`Judicial` |
| 29 | `handle_1` | `text` | Yes |  |  | `KingForTexas`<br>`JoeGruters`<br>`shannonerickson1`<br>`shannongrove`<br>`sharonhewitt` |
| 30 | `handle_2` | `text` | Yes |  |  | `SheilaRuth`<br>`StaterepBain2`<br>`PBaumbachDE`<br>`abelherrero`<br>`AlabamaWilliams` |
| 31 | `camphand` | `text` | Yes |  |  | `KingForTexas`<br>`JoeGrutersFL`<br>`ShannonGroveForStateSenate`<br>`aswsumter`<br>`tnmichaelcurcio` |
| 32 | `offhand` | `text` | Yes |  |  | `repshannonerickson`<br>`ShannonGroveCA`<br>`RepTerryCanales`<br>`natalie.manley.5`<br>`StateRepresentativeRhondaBurnough` |
| 33 | `perhand` | `text` | Yes |  |  | `JoeGruters`<br>`sserickson`<br>`shannon.grove.39`<br>`sharon.w.hewitt`<br>`shavonda.sumter` |
| 34 | `shor_ideo` | `double precision` | Yes |  |  | `0.757`<br>`0.534`<br>`0.876`<br>`1.654`<br>`0.796` |
| 35 | `median_chamber` | `double precision` | Yes |  |  | `0.8065`<br>`0.4185`<br>`0.7885`<br>`-1.2925`<br>`0.606` |
| 36 | `dis_median` | `double precision` | Yes |  |  | `0.0495`<br>`0.1155`<br>`0.0875`<br>`2.9465`<br>`0.19` |
| 37 | `median_party` | `double precision` | Yes |  |  | `1.41`<br>`0.616`<br>`0.913`<br>`1.3`<br>`0.816` |
| 38 | `heterogeneity` | `double precision` | Yes |  |  | `0.59472033`<br>`0.23283563`<br>`0.417542428`<br>`0.389468099`<br>`0.246614405` |
| 39 | `polarization` | `double precision` | Yes |  |  | `2.745`<br>`1.778`<br>`1.7075`<br>`2.874`<br>`1.375` |
| 40 | `mrp_ideology` | `double precision` | Yes |  |  | `0.329003681`<br>`0.082495937`<br>`0.118645532`<br>`0.025572714`<br>`0.222746754` |
| 41 | `mrp_ideology_se` | `double precision` | Yes |  |  | `0.049979675`<br>`0.041625949`<br>`0.072528212`<br>`0.039582038`<br>`0.057549909` |
| 42 | `boundaries_election_year` | `integer` | Yes |  |  | `2020` |
| 43 | `demshare_pres` | `double precision` | Yes |  |  | `0.166188605`<br>`0.43154284`<br>`0.436522417`<br>`0.40584839`<br>`0.187727307` |
| 44 | `source_1` | `text` | Yes |  |  | `cook`<br>`https://ballotpedia.org/Shannon_Erickson`<br>`https://www.google.com/search?client=safari&rls=en&q=California+Shannon+Grove+senator&ie=UTF-8&oe=UTF-8`<br>`https://www.google.com/search?client=safari&rls=en&q=Texas+Terry+Meza&ie=UTF-8&oe=UTF-8`<br>`https://www.google.com/search?client=safari&rls=en&q=New+Hampshire+Timothy+Horrigan&ie=UTF-8&oe=UTF-8` |
| 45 | `source_2` | `text` | Yes |  |  | `cook`<br>`https://www.sierraforaz.com`<br>`https://www.lorifor22.com`<br>`https://twitter.com/senkooyenga?lang=en`<br>`https://twitter.com/MoniqueLimonCA?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor` |
| 46 | `created_at` | `timestamp without time zone` | Yes | Default: CURRENT_TIMESTAMP |  | `2026-01-18T04:05:38.251Z` |
| 47 | `updated_at` | `timestamp without time zone` | Yes | Default: CURRENT_TIMESTAMP |  | `2026-01-18T04:05:38.251Z` |

### EDA Population Ratios

Exact full-population counts over this stored relation. Valid text values exclude SQL nulls, blanks, and common pseudo-missing tokens such as `NaN`, `NA`, `N/A`, `null`, `none`, and `|NA|NA|NA`.

| Field | Valid Population | Invalid / Missing | Distinct Valid Values | Top Valid Values by Population Ratio |
|---|---:|---:|---:|---|
| `lid` | 5,927 / 5,927 (100.00%) | 0 / 5,927 (0.00%) | 5,927 | `1000136281408466944` (1; 0.02%)<br>`1000541656138076160` (1; 0.02%)<br>`1001107633930108928` (1; 0.02%)<br>`100115449` (1; 0.02%)<br>`100128958` (1; 0.02%)<br>`1001487003022602240` (1; 0.02%)<br>`1001831097355980800` (1; 0.02%)<br>`1002276549607985152` (1; 0.02%) |
| `name` | 5,927 / 5,927 (100.00%) | 0 / 5,927 (0.00%) | 5,875 | `@BreanneDavis` (2; 0.03%)<br>`@DbqRepLundgren` (2; 0.03%)<br>`@MaryAnnLisanti` (2; 0.03%)<br>`@matthewmaddock` (2; 0.03%)<br>`@skyler_wheeler` (2; 0.03%)<br>`adam gomez` (2; 0.03%)<br>`amanda septimo` (2; 0.03%)<br>`anthony rendon` (2; 0.03%) |
| `handle` | 5,543 / 5,927 (93.52%) | 384 / 5,927 (6.48%) | 5,469 | `amandaforpa` (2; 0.03%)<br>`AmandaSeptimo` (2; 0.03%)<br>`AsmVillapudua` (2; 0.03%)<br>`BreanneDavis` (2; 0.03%)<br>`brettharrell` (2; 0.03%)<br>`BurdickAD93` (2; 0.03%)<br>`campaignconrad` (2; 0.03%)<br>`CharlesDLavine` (2; 0.03%) |
| `state` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 50 | `NY` (164; 2.77%)<br>`TX` (145; 2.45%)<br>`MN` (143; 2.41%)<br>`MA` (140; 2.36%)<br>`PA` (133; 2.24%)<br>`NH` (126; 2.13%)<br>`FL` (124; 2.09%)<br>`GA` (119; 2.01%) |
| `chamber` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 2 | `H` (2,515; 42.43%)<br>`S` (1,134; 19.13%) |
| `party` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 3 | `Democratic` (1,946; 32.83%)<br>`Republican` (1,684; 28.41%)<br>`Independent` (19; 0.32%) |
| `official_id` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 3,613 | `baldehsamba1` (2; 0.03%)<br>`baumbachpaul1` (2; 0.03%)<br>`benhamjessica1` (2; 0.03%)<br>`burkeautumn1` (2; 0.03%)<br>`conradwilliam1` (2; 0.03%)<br>`cooneyjeremy1` (2; 0.03%)<br>`cordesmari1` (2; 0.03%)<br>`cortesedave1` (2; 0.03%) |
| `author_id2` | 165 / 5,927 (2.78%) | 5,762 / 5,927 (97.22%) | 129 | `1053307619002249216` (2; 0.03%)<br>`1084358408` (2; 0.03%)<br>`1252417786149777408` (2; 0.03%)<br>`1326168387505025024` (2; 0.03%)<br>`1326176429588013056` (2; 0.03%)<br>`1329106574082641920` (2; 0.03%)<br>`1330015251220361216` (2; 0.03%)<br>`1343081497188855808` (2; 0.03%) |
| `firstname` | 3,648 / 5,927 (61.55%) | 2,279 / 5,927 (38.45%) | 1,589 | `John` (52; 0.88%)<br>`David` (50; 0.84%)<br>`Michael` (34; 0.57%)<br>`Brian` (29; 0.49%)<br>`Chris` (29; 0.49%)<br>`Mark` (29; 0.49%)<br>`Jason` (26; 0.44%)<br>`Mike` (26; 0.44%) |
| `lastname` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 3,008 | `Smith` (15; 0.25%)<br>`Jones` (10; 0.17%)<br>`Williams` (10; 0.17%)<br>`Davis` (9; 0.15%)<br>`Jackson` (9; 0.15%)<br>`johnson` (9; 0.15%)<br>`Johnson` (9; 0.15%)<br>`smith` (8; 0.13%) |
| `gender` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 2 | `M` (2,439; 41.15%)<br>`F` (1,210; 20.42%) |
| `race` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 8 | `White` (2,950; 49.77%)<br>`Black` (382; 6.45%)<br>`Latino` (189; 3.19%)<br>`Asian American` (82; 1.38%)<br>`Multiracial` (20; 0.34%)<br>`Native American` (16; 0.27%)<br>`MENA` (9; 0.15%)<br>`Asian American and Native` (1; 0.02%) |
| `district_num` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 604 | `15` (61; 1.03%)<br>`19` (61; 1.03%)<br>`11` (60; 1.01%)<br>`24` (55; 0.93%)<br>`13` (53; 0.89%)<br>`17` (53; 0.89%)<br>`25` (53; 0.89%)<br>`16` (52; 0.88%) |
| `district_num_sld` | 3,567 / 5,927 (60.18%) | 2,360 / 5,927 (39.82%) | 500 | `11` (62; 1.05%)<br>`15` (62; 1.05%)<br>`19` (60; 1.01%)<br>`24` (57; 0.96%)<br>`35` (56; 0.94%)<br>`25` (54; 0.91%)<br>`13` (53; 0.89%)<br>`16` (53; 0.89%) |
| `district_name` | 2,293 / 5,927 (38.69%) | 3,634 / 5,927 (61.31%) | 2,214 | `Florida` (4; 0.07%)<br>`Georgia` (4; 0.07%)<br>`Maryland House of Delegates District 20` (3; 0.05%)<br>`New Hampshire House of Representatives Hillsborough 12` (3; 0.05%)<br>`Alabama` (2; 0.03%)<br>`California State Assembly District 62` (2; 0.03%)<br>`California State Senate District 15` (2; 0.03%)<br>`California State Senate District 17` (2; 0.03%) |
| `district_type` | 2,293 / 5,927 (38.69%) | 3,634 / 5,927 (61.31%) | 14 | `State Legislative (Lower)` (1,347; 22.73%)<br>`State Legislative (Upper)` (827; 13.95%)<br>`State` (40; 0.67%)<br>`Congress` (33; 0.56%)<br>`County` (10; 0.17%)<br>`County subdivision` (10; 0.17%)<br>`City-town subdivision` (6; 0.10%)<br>`State subdivision` (5; 0.08%) |
| `district_ocdid` | 2,283 / 5,927 (38.52%) | 3,644 / 5,927 (61.48%) | 2,204 | `ocd-division/country:us/state:fl` (4; 0.07%)<br>`ocd-division/country:us/state:ga` (4; 0.07%)<br>`ocd-division/country:us/state:md/sldl:20` (3; 0.05%)<br>`ocd-division/country:us/state:nh/sldl:hillsborough_12` (3; 0.05%)<br>`ocd-division/country:us/state:al` (2; 0.03%)<br>`ocd-division/country:us/state:ca/sldl:62` (2; 0.03%)<br>`ocd-division/country:us/state:ca/sldu:15` (2; 0.03%)<br>`ocd-division/country:us/state:ca/sldu:17` (2; 0.03%) |
| `yr_elected` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 47 | `2019` (406; 6.85%)<br>`2015` (365; 6.16%)<br>`2017` (347; 5.85%)<br>`2013` (327; 5.52%)<br>`2021` (294; 4.96%)<br>`2018` (259; 4.37%)<br>`2016` (251; 4.23%)<br>`2020` (248; 4.18%) |
| `yr_left_office` | 606 / 5,927 (10.22%) | 5,321 / 5,927 (89.78%) | 8 | `2021` (296; 4.99%)<br>`2020` (215; 3.63%)<br>`2022` (82; 1.38%)<br>`2019` (6; 0.10%)<br>`2018` (4; 0.07%)<br>`2016` (1; 0.02%)<br>`2017` (1; 0.02%)<br>`2029` (1; 0.02%) |
| `vote_pct` | 3,648 / 5,927 (61.55%) | 2,279 / 5,927 (38.45%) | 672 | `100` (660; 11.14%)<br>`59.6` (19; 0.32%)<br>`51.5` (17; 0.29%)<br>`55.1` (17; 0.29%)<br>`64.9` (17; 0.29%)<br>`63.4` (16; 0.27%)<br>`98.5` (16; 0.27%)<br>`98.6` (16; 0.27%) |
| `yr_vote` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 8 | `2020` (2,495; 42.10%)<br>`2018` (765; 12.91%)<br>`2019` (170; 2.87%)<br>`2021` (110; 1.86%)<br>`2016` (85; 1.43%)<br>`2022` (18; 0.30%)<br>`2017` (5; 0.08%)<br>`2014` (1; 0.02%) |
| `bp_url` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 3,611 | `https://ballotpedia.org/Adam_Gomez` (2; 0.03%)<br>`https://ballotpedia.org/Amanda_Septimo` (2; 0.03%)<br>`https://ballotpedia.org/Anthony_Rendon` (2; 0.03%)<br>`https://ballotpedia.org/Antonio_Parkinson` (2; 0.03%)<br>`https://ballotpedia.org/Autumn_Burke` (2; 0.03%)<br>`https://ballotpedia.org/Bill_Cunningham_(Illinois)` (2; 0.03%)<br>`https://ballotpedia.org/Charles_Lavine` (2; 0.03%)<br>`https://ballotpedia.org/Dave_Cortese_(California)` (2; 0.03%) |
| `state_fips` | 3,649 / 5,927 (61.57%) | 2,278 / 5,927 (38.43%) | 50 | `36` (164; 2.77%)<br>`48` (145; 2.45%)<br>`27` (143; 2.41%)<br>`25` (140; 2.36%)<br>`42` (133; 2.24%)<br>`33` (126; 2.13%)<br>`12` (124; 2.09%)<br>`13` (119; 2.01%) |
| `sld_fips` | 3,443 / 5,927 (58.09%) | 2,484 / 5,927 (41.91%) | 2,654 | `54035` (5; 0.08%)<br>`18035` (4; 0.07%)<br>`24019` (4; 0.07%)<br>`30026` (4; 0.07%)<br>`33003` (4; 0.07%)<br>`36038` (4; 0.07%)<br>`36056` (4; 0.07%)<br>`44015` (4; 0.07%) |
| `state_full` | 2,293 / 5,927 (38.69%) | 3,634 / 5,927 (61.31%) | 49 | `NY` (116; 1.96%)<br>`TX` (108; 1.82%)<br>`MA` (106; 1.79%)<br>`PA` (93; 1.57%)<br>`MN` (90; 1.52%)<br>`MD` (77; 1.30%)<br>`FL` (74; 1.25%)<br>`SC` (71; 1.20%) |
| `office_name` | 2,293 / 5,927 (38.69%) | 3,634 / 5,927 (61.31%) | 2,235 | `Maryland House of Delegates District 20` (3; 0.05%)<br>`New Hampshire House of Representatives Hillsborough 12` (3; 0.05%)<br>`California State Assembly District 62` (2; 0.03%)<br>`California State Senate District 15` (2; 0.03%)<br>`California State Senate District 17` (2; 0.03%)<br>`California State Senate District 37` (2; 0.03%)<br>`Colorado State Senate District 20` (2; 0.03%)<br>`Delaware House of Representatives District 23` (2; 0.03%) |
| `office_level` | 2,293 / 5,927 (38.69%) | 3,634 / 5,927 (61.31%) | 3 | `State` (2,221; 37.47%)<br>`Local` (39; 0.66%)<br>`Federal` (33; 0.56%) |
| `office_branch` | 2,293 / 5,927 (38.69%) | 3,634 / 5,927 (61.31%) | 3 | `Legislative` (2,228; 37.59%)<br>`Executive` (57; 0.96%)<br>`Judicial` (8; 0.13%) |
| `handle_1` | 3,648 / 5,927 (61.55%) | 2,279 / 5,927 (38.45%) | 3,612 | `AmandaSeptimo` (2; 0.03%)<br>`AsmAutumnBurke` (2; 0.03%)<br>`campaignconrad` (2; 0.03%)<br>`CharlesDLavine` (2; 0.03%)<br>`Cutter4Colorado` (2; 0.03%)<br>`DaveMinCA` (2; 0.03%)<br>`DavidOforNevada` (2; 0.03%)<br>`DeniseCH50` (2; 0.03%) |
| `handle_2` | 177 / 5,927 (2.99%) | 5,750 / 5,927 (97.01%) | 141 | `140thBill` (2; 0.03%)<br>`2_Shay` (2; 0.03%)<br>`AdamGomezMA` (2; 0.03%)<br>`Amanda_Bx84` (2; 0.03%)<br>`autumnrburke` (2; 0.03%)<br>`CharlesLavineNY` (2; 0.03%)<br>`DaveCortese` (2; 0.03%)<br>`DeniseCH1` (2; 0.03%) |
| `camphand` | 1,505 / 5,927 (25.39%) | 4,422 / 5,927 (74.61%) | 1,488 | `AmandaSeptimoBX` (2; 0.03%)<br>`anthonyrendonforassembly` (2; 0.03%)<br>`AssemblymemberAutumnBurke` (2; 0.03%)<br>`CutterForColorado` (2; 0.03%)<br>`davecortese2020` (2; 0.03%)<br>`DavidOforNevada` (2; 0.03%)<br>`DeniseCrosswhiteHaderOK41` (2; 0.03%)<br>`ElectAdamGomez` (2; 0.03%) |
| `offhand` | 1,201 / 5,927 (20.26%) | 4,726 / 5,927 (79.74%) | 1,181 | `AdamGomezMA` (2; 0.03%)<br>`amanda.bx84` (2; 0.03%)<br>`assemblywomansillitti` (2; 0.03%)<br>`CharlesLavineNY` (2; 0.03%)<br>`davecortesegov` (2; 0.03%)<br>`JerrySonnenbergforCO` (2; 0.03%)<br>`moralesfortexas` (2; 0.03%)<br>`paulbaumbach23` (2; 0.03%) |
| `perhand` | 2,590 / 5,927 (43.70%) | 3,337 / 5,927 (56.30%) | 2,563 | `aseptimo` (2; 0.03%)<br>`dave.cortese` (2; 0.03%)<br>`david.orentlicher.7` (2; 0.03%)<br>`denise.hader` (2; 0.03%)<br>`dkmin76` (2; 0.03%)<br>`dora.drake` (2; 0.03%)<br>`gina.sillitti` (2; 0.03%)<br>`herimorales` (2; 0.03%) |
| `shor_ideo` | 3,282 / 5,927 (55.37%) | 2,645 / 5,927 (44.63%) | 2,033 | `-1.048` (8; 0.13%)<br>`-1.078` (7; 0.12%)<br>`-1.147` (6; 0.10%)<br>`-1.133` (6; 0.10%)<br>`-1.081` (6; 0.10%)<br>`-1.077` (6; 0.10%)<br>`0.909` (6; 0.10%)<br>`0.949` (6; 0.10%) |
| `median_chamber` | 3,088 / 5,927 (52.10%) | 2,839 / 5,927 (47.90%) | 98 | `0.8065` (102; 1.72%)<br>`-1.0975` (97; 1.64%)<br>`-1.1155` (86; 1.45%)<br>`-0.7775` (83; 1.40%)<br>`-0.861` (80; 1.35%)<br>`0.364` (79; 1.33%)<br>`0.8175` (76; 1.28%)<br>`1.2685` (76; 1.28%) |
| `dis_median` | 3,088 / 5,927 (52.10%) | 2,839 / 5,927 (47.90%) | 2,008 | `0` (15; 0.25%)<br>`0.076` (9; 0.15%)<br>`0.009` (8; 0.13%)<br>`0.058` (8; 0.13%)<br>`0.0005` (7; 0.12%)<br>`0.0025` (7; 0.12%)<br>`0.004` (6; 0.10%)<br>`0.0205` (6; 0.10%) |
| `median_party` | 3,088 / 5,927 (52.10%) | 2,839 / 5,927 (47.90%) | 197 | `-1.1335` (79; 1.33%)<br>`-1.3785` (67; 1.13%)<br>`1.41` (61; 1.03%)<br>`-1.211` (59; 1.00%)<br>`-1.059` (58; 0.98%)<br>`-0.754` (56; 0.94%)<br>`1.419` (51; 0.86%)<br>`-1.3` (49; 0.83%) |
| `heterogeneity` | 3,084 / 5,927 (52.03%) | 2,843 / 5,927 (47.97%) | 199 | `0.128595733` (79; 1.33%)<br>`0.39659256` (67; 1.13%)<br>`0.59472033` (61; 1.03%)<br>`0.476216272` (59; 1.00%)<br>`0.284989754` (58; 0.98%)<br>`0.210556233` (56; 0.94%)<br>`0.380843871` (51; 0.86%)<br>`0.395854784` (49; 0.83%) |
| `polarization` | 3,088 / 5,927 (52.10%) | 2,839 / 5,927 (47.90%) | 96 | `2.745` (102; 1.72%)<br>`1.88` (99; 1.67%)<br>`1.2885` (97; 1.64%)<br>`1.7595` (92; 1.55%)<br>`1.4105` (86; 1.45%)<br>`1.347` (85; 1.43%)<br>`2.343` (80; 1.35%)<br>`1.4495` (79; 1.33%) |
| `mrp_ideology` | 3,335 / 5,927 (56.27%) | 2,592 / 5,927 (43.73%) | 2,964 | `0.043358502` (5; 0.08%)<br>`-0.59240158` (4; 0.07%)<br>`-0.323114004` (4; 0.07%)<br>`-0.14950795` (4; 0.07%)<br>`-0.069332347` (4; 0.07%)<br>`-0.552749411` (3; 0.05%)<br>`-0.45639807` (3; 0.05%)<br>`-0.407129241` (3; 0.05%) |
| `mrp_ideology_se` | 3,335 / 5,927 (56.27%) | 2,592 / 5,927 (43.73%) | 2,964 | `0.059868512` (5; 0.08%)<br>`0.049513525` (4; 0.07%)<br>`0.053567262` (4; 0.07%)<br>`0.059872874` (4; 0.07%)<br>`0.082375602` (4; 0.07%)<br>`0.039385518` (3; 0.05%)<br>`0.041636563` (3; 0.05%)<br>`0.04181707` (3; 0.05%) |
| `boundaries_election_year` | 3,335 / 5,927 (56.27%) | 2,592 / 5,927 (43.73%) | 1 | `2020` (3,335; 56.27%) |
| `demshare_pres` | 2,938 / 5,927 (49.57%) | 2,989 / 5,927 (50.43%) | 2,602 | `0.478858873` (5; 0.08%)<br>`0.599809556` (4; 0.07%)<br>`0.779731236` (4; 0.07%)<br>`0.908777198` (4; 0.07%)<br>`0.306907662` (3; 0.05%)<br>`0.356761723` (3; 0.05%)<br>`0.390830013` (3; 0.05%)<br>`0.404462028` (3; 0.05%) |
| `source_1` | 3,145 / 5,927 (53.06%) | 2,782 / 5,927 (46.94%) | 1,884 | `cook` (1,188; 20.04%)<br>`googling` (29; 0.49%)<br>`https://www.alaha.org/advocacy/state/legislative-offices/alabama-legislature-twitter-hand...` (19; 0.32%)<br>`https://ballotpedia.org/David_Orentlicher_(Nevada)` (2; 0.03%)<br>`https://ballotpedia.org/Ron_Ferguson` (2; 0.03%)<br>`https://twitter.com/DaveMinCA?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor` (2; 0.03%)<br>`https://twitter.com/electadamgomez?lang=en` (2; 0.03%)<br>`https://twitter.com/joshhurlbert?lang=en` (2; 0.03%) |
| `source_2` | 158 / 5,927 (2.67%) | 5,769 / 5,927 (97.33%) | 128 | `cook` (15; 0.25%)<br>`https://ballotpedia.org/Ron_Ferguson` (2; 0.03%)<br>`https://twitter.com/AdamGomezMA?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor` (2; 0.03%)<br>`https://twitter.com/davecortese?lang=en` (2; 0.03%)<br>`https://twitter.com/dora_wi?lang=en` (2; 0.03%)<br>`https://twitter.com/eddiemoralesjr?lang=en` (2; 0.03%)<br>`https://twitter.com/keldahelenroys?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor` (2; 0.03%)<br>`https://twitter.com/MoniqueLimonCA?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor` (2; 0.03%) |
| `created_at` | 5,927 / 5,927 (100.00%) | 0 / 5,927 (0.00%) | 1 | `2026-01-18T04:05:38.251Z` (5,927; 100.00%) |
| `updated_at` | 5,927 / 5,927 (100.00%) | 0 / 5,927 (0.00%) | 1 | `2026-01-18T04:05:38.251Z` (5,927; 100.00%) |

### Constraints

| Name | Type | Definition |
|---|---|---|
| `legislators_chamber_check` | Check | `CHECK (chamber IS NULL OR (chamber = ANY (ARRAY['H'::text, 'S'::text])))` |
| `legislators_party_check` | Check | `CHECK (party IS NULL OR (party = ANY (ARRAY['Democratic'::text, 'Republican'::text, 'Independent'::text, 'Other'::text])))` |
| `legislators_pkey` | Primary key | `PRIMARY KEY (lid)` |

### Indexes

| Name | Definition |
|---|---|
| `idx_legislators_handle` | `CREATE INDEX idx_legislators_handle ON public.legislators USING btree (handle)` |
| `idx_legislators_party` | `CREATE INDEX idx_legislators_party ON public.legislators USING btree (party)` |
| `idx_legislators_state` | `CREATE INDEX idx_legislators_state ON public.legislators USING btree (state)` |
| `legislators_pkey` | `CREATE UNIQUE INDEX legislators_pkey ON public.legislators USING btree (lid)` |

### Example Rows

```json
[
  {
    "lid": "861436278755033088",
    "name": "@riggs4missouri",
    "handle": "riggs4missouri",
    "state": null,
    "chamber": null,
    "party": null,
    "official_id": null,
    "author_id2": null,
    "firstname": null,
    "lastname": null,
    "gender": null,
    "race": null,
    "district_num": null,
    "district_num_sld": null,
    "district_name": null,
    "district_type": null,
    "district_ocdid": null,
    "yr_elected": null,
    "yr_left_office": null,
    "vote_pct": null,
    "yr_vote": null,
    "bp_url": null,
    "state_fips": null,
    "sld_fips": null,
    "state_full": null,
    "office_name": null,
    "office_level": null,
    "office_branch": null,
    "handle_1": null,
    "handle_2": null,
    "camphand": null,
    "offhand": null,
    "perhand": null,
    "shor_ideo": null,
    "median_chamber": null,
    "dis_median": null,
    "median_party": null,
    "heterogeneity": null,
    "polarization": null,
    "mrp_ideology": null,
    "mrp_ideology_se": null,
    "boundaries_election_year": null,
    "demshare_pres": null,
    "source_1": null,
    "source_2": null,
    "created_at": "2026-01-18T04:05:38.251Z",
    "updated_at": "2026-01-18T04:05:38.251Z"
  },
  {
    "lid": "444464812",
    "name": "ken king",
    "handle": "KingForTexas",
    "state": "TX",
    "chamber": "H",
    "party": "Republican",
    "official_id": "kingken1",
    "author_id2": null,
    "firstname": "Ken",
    "lastname": "King",
    "gender": "M",
    "race": "White",
    "district_num": "88",
    "district_num_sld": "88",
    "district_name": "Texas House of Representatives District 88",
    "district_type": "State Legislative (Lower)",
    "district_ocdid": "ocd-division/country:us/state:tx/sldl:88",
    "yr_elected": "2013",
    "yr_left_office": null,
    "vote_pct": "100",
    "yr_vote": "2020",
    "bp_url": "https://ballotpedia.org/Ken_King",
    "state_fips": "48",
    "sld_fips": "48088",
    "state_full": "TX",
    "office_name": "Texas House of Representatives District 88",
    "office_level": "State",
    "office_branch": "Legislative",
    "handle_1": "KingForTexas",
    "handle_2": null,
    "camphand": "KingForTexas",
    "offhand": null,
    "perhand": null,
    "shor_ideo": "0.757",
    "median_chamber": "0.8065",
    "dis_median": "0.0495",
    "median_party": "1.41",
    "heterogeneity": "0.59472033",
    "polarization": "2.745",
    "mrp_ideology": "0.329003681",
    "mrp_ideology_se": "0.049979675",
    "boundaries_election_year": "2020",
    "demshare_pres": "0.166188605",
    "source_1": "cook",
    "source_2": null,
    "created_at": "2026-01-18T04:05:38.251Z",
    "updated_at": "2026-01-18T04:05:38.251Z"
  },
  {
    "lid": "40045792",
    "name": "joe gruters",
    "handle": "JoeGruters",
    "state": "FL",
    "chamber": "S",
    "party": "Republican",
    "official_id": "grutersjoe1",
    "author_id2": null,
    "firstname": "Joe",
    "lastname": "Gruters",
    "gender": "M",
    "race": "White",
    "district_num": "23",
    "district_num_sld": "23",
    "district_name": "Florida State Senate District 22",
    "district_type": "State Legislative (Upper)",
    "district_ocdid": "ocd-division/country:us/state:fl/sldu:22",
    "yr_elected": "2018",
    "yr_left_office": null,
    "vote_pct": "57.7",
    "yr_vote": "2020",
    "bp_url": "https://ballotpedia.org/Joe_Gruters",
    "state_fips": "12",
    "sld_fips": "12023",
    "state_full": "FL",
    "office_name": "Florida State Senate District 22",
    "office_level": "State",
    "office_branch": "Legislative",
    "handle_1": "JoeGruters",
    "handle_2": null,
    "camphand": "JoeGrutersFL",
    "offhand": null,
    "perhand": "JoeGruters",
    "shor_ideo": "0.534",
    "median_chamber": "0.4185",
    "dis_median": "0.1155",
    "median_party": "0.616",
    "heterogeneity": "0.23283563",
    "polarization": "1.778",
    "mrp_ideology": "0.082495937",
    "mrp_ideology_se": "0.041625949",
    "boundaries_election_year": "2020",
    "demshare_pres": "0.43154284",
    "source_1": "cook",
    "source_2": null,
    "created_at": "2026-01-18T04:05:38.251Z",
    "updated_at": "2026-01-18T04:05:38.251Z"
  }
]
```

## public.posts

- Type: Base table
- Rows: estimated 22,190,944
- Total relation size: 8.8 GB

### Fields

| # | Field | Type | Nullable | Default / Generated | Constraints | Example contents |
|---:|---|---|---|---|---|---|
| 1 | `id` | `bigint` | No | Default: nextval('posts_id_seq'::regclass) | PK: posts_pkey | `3430`<br>`3431`<br>`3432`<br>`3433`<br>`3434` |
| 2 | `tweet_id` | `text` | Yes |  |  | `1214326852262625280`<br>`1214290147354656768`<br>`1214244441445167104`<br>`1214325224990224384`<br>`1214596554306260992` |
| 3 | `lid` | `text` | No |  | FK: FOREIGN KEY (lid) REFERENCES legislators(lid) ON DELETE CASCADE | `821531827579949056`<br>`1125498438798401536`<br>`3040340676`<br>`52612182`<br>`108427276` |
| 4 | `created_at` | `date` | No |  |  | `2020-01-06T05:00:00.000Z`<br>`2020-01-07T05:00:00.000Z`<br>`2020-01-04T05:00:00.000Z`<br>`2020-01-02T05:00:00.000Z`<br>`2020-01-01T05:00:00.000Z` |
| 5 | `text` | `text` | Yes |  |  | `The California Green New Deal will help to reduce greenhouse gas emissions in order to avoid catastrophic consequences of climate change while also addressing economic inequality ...`<br>`RT @KansenChu: Happening now! Happy to stand along side with my colleagues as a co-author of Assemblymember Rob Bontas Green New Deal legi&`<br>`RT @AssemblyDems: During recess, our Members have received input from constituents on how to better their communities. Now they're #Backi&`<br>`I am glad to be back in Sacramento working on behalf of the 52nd Assembly District! We are beginning the second year of our legislative session and there is much to accomplish. As...`<br>`Congratulations Chief Falvo @schdypolice  thank you for the work you do to keep our community safe. https://t.co/XdmFROLgSZ` |
| 6 | `retweet_count` | `integer` | Yes | Default: 0 |  | `7`<br>`2`<br>`4`<br>`1`<br>`0` |
| 7 | `like_count` | `integer` | Yes | Default: 0 |  | `22`<br>`0`<br>`11`<br>`1`<br>`8` |
| 8 | `reply_count` | `integer` | Yes | Default: 0 |  | `0` |
| 9 | `quote_count` | `integer` | Yes | Default: 0 |  | `0` |
| 10 | `favorite_count` | `integer` | Yes | Default: 0 |  | `0` |
| 11 | `topic` | `text` | No |  | FK: FOREIGN KEY (topic) REFERENCES topics(topic) ON DELETE RESTRICT | `7`<br>`14`<br>`20`<br>`12`<br>`999` |
| 12 | `topic_probability` | `double precision` | Yes |  |  | `0.9863`<br>`0.6602`<br>`0.5942`<br>`0.9253`<br>`0.9727` |
| 13 | `topic_confidence` | `double precision` | Yes |  |  | `0.9863`<br>`0.6602`<br>`0.5942`<br>`0.9253`<br>`0.9727` |
| 14 | `tox_toxicity` | `double precision` | Yes |  |  | `0.012126249`<br>`0.008544922`<br>`0.016964182`<br>`0.022846194`<br>`0.017843807` |
| 15 | `tox_severe_toxicity` | `double precision` | Yes |  |  | _No non-null values found_ |
| 16 | `tox_obscene` | `double precision` | Yes |  |  | _No non-null values found_ |
| 17 | `tox_threat` | `double precision` | Yes |  |  | _No non-null values found_ |
| 18 | `tox_insult` | `double precision` | Yes |  |  | _No non-null values found_ |
| 19 | `tox_identity_attack` | `double precision` | Yes |  |  | _No non-null values found_ |
| 20 | `count_misinfo` | `integer` | Yes | Default: 0 |  | `0` |
| 21 | `misinfo_score` | `double precision` | Yes |  |  | _No non-null values found_ |
| 22 | `political_score` | `double precision` | Yes |  |  | `1`<br>`0.9995`<br>`0.9996`<br>`0`<br>`0.9999` |
| 23 | `is_political` | `boolean` | Yes |  |  | `true`<br>`false` |
| 24 | `created_at_timestamp` | `timestamp without time zone` | Yes | Default: CURRENT_TIMESTAMP |  | `2026-01-18T04:05:38.836Z` |

### EDA Population Ratios

Approximate PostgreSQL planner statistics. Ratios use `pg_stats.null_frac` and `most_common_freqs`; counts use the relation row estimate as denominator. Pseudo-missing string tokens are not separately excluded unless PostgreSQL stored them as SQL nulls.

| Field | Valid Population | Invalid / Missing | Distinct Valid Values | Top Valid Values by Population Ratio |
|---|---:|---:|---:|---|
| `id` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 22,190,944 | _No valid value distribution available_ |
| `tweet_id` | 21,375,797 / 22,190,944 (96.33%) | 815,147 / 22,190,944 (3.67%) | 1,479,351 | _No valid value distribution available_ |
| `lid` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 3,249 | `1033943323` (205,636; 0.93%)<br>`115576195` (162,734; 0.73%)<br>`608826805` (127,228; 0.57%)<br>`395784978` (106,517; 0.48%)<br>`4842843378` (100,599; 0.45%)<br>`712842098228105216` (99,120; 0.45%)<br>`234815333` (92,462; 0.42%)<br>`358432869` (92,462; 0.42%) |
| `created_at` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 1,298 | `2022-08-18` (130,187; 0.59%)<br>`2022-08-17` (124,269; 0.56%)<br>`2022-08-09` (121,310; 0.55%)<br>`2022-08-20` (121,310; 0.55%)<br>`2022-08-19` (118,352; 0.53%)<br>`2022-08-16` (108,736; 0.49%)<br>`2022-08-03` (105,777; 0.48%)<br>`2022-08-10` (103,558; 0.47%) |
| `text` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 1,456,838 | _No valid value distribution available_ |
| `retweet_count` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 2,589 | `0` (7,308,218; 32.93%)<br>`1` (2,787,922; 12.56%)<br>`2` (1,766,399; 7.96%)<br>`3` (1,179,818; 5.32%)<br>`4` (906,870; 4.09%)<br>`5` (697,535; 3.14%)<br>`6` (534,802; 2.41%)<br>`7` (426,806; 1.92%) |
| `like_count` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 576 | `0` (10,832,140; 48.81%)<br>`1` (2,012,719; 9.07%)<br>`2` (1,287,814; 5.80%)<br>`3` (879,501; 3.96%)<br>`4` (736,739; 3.32%)<br>`5` (560,691; 2.53%)<br>`6` (444,559; 2.00%)<br>`7` (401,656; 1.81%) |
| `reply_count` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 123 | `0` (18,519,082; 83.45%)<br>`1` (1,844,067; 8.31%)<br>`2` (622,826; 2.81%)<br>`3` (316,591; 1.43%)<br>`4` (167,172; 0.75%)<br>`5` (102,078; 0.46%)<br>`6` (81,367; 0.37%)<br>`7` (66,573; 0.30%) |
| `quote_count` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 54 | `0` (20,954,169; 94.43%)<br>`1` (687,180; 3.10%)<br>`2` (212,293; 0.96%)<br>`3` (93,202; 0.42%)<br>`4` (63,614; 0.29%)<br>`6` (30,328; 0.14%)<br>`5` (25,889; 0.12%)<br>`7` (17,013; 0.08%) |
| `favorite_count` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 1 | `0` (22,190,944; 100.00%) |
| `topic` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 22 | `999` (8,582,718; 38.68%)<br>`20` (2,566,752; 11.57%)<br>`2` (1,662,841; 7.49%)<br>`3` (1,540,052; 6.94%)<br>`12` (1,137,656; 5.13%)<br>`6` (1,124,341; 5.07%)<br>`0` (815,147; 3.67%)<br>`13` (792,956; 3.57%) |
| `topic_probability` | 21,375,797 / 22,190,944 (96.33%) | 815,147 / 22,190,944 (3.67%) | 2,159 | `0.9766` (232,265; 1.05%)<br>`0.9756` (223,389; 1.01%)<br>`0.9771` (223,389; 1.01%)<br>`0.9775` (218,951; 0.99%)<br>`0.978` (215,252; 0.97%)<br>`0.9746` (213,773; 0.96%)<br>`0.9751` (207,855; 0.94%)<br>`0.9761` (206,376; 0.93%) |
| `topic_confidence` | 21,375,797 / 22,190,944 (96.33%) | 815,147 / 22,190,944 (3.67%) | 2,159 | `0.9766` (232,265; 1.05%)<br>`0.9756` (223,389; 1.01%)<br>`0.9771` (223,389; 1.01%)<br>`0.9775` (218,951; 0.99%)<br>`0.978` (215,252; 0.97%)<br>`0.9746` (213,773; 0.96%)<br>`0.9751` (207,855; 0.94%)<br>`0.9761` (206,376; 0.93%) |
| `tox_toxicity` | 992,675 / 22,190,944 (4.47%) | 21,198,269 / 22,190,944 (95.53%) | 822 | `0.009864358` (6,657; 0.03%)<br>`0.01024134` (5,918; 0.03%)<br>`0.019854378` (5,918; 0.03%)<br>`0.0201057` (5,918; 0.03%)<br>`0.046120718` (5,918; 0.03%) |
| `tox_severe_toxicity` | 0 / 22,190,944 (0.00%) | 22,190,944 / 22,190,944 (100.00%) | 0 | _No valid value distribution available_ |
| `tox_obscene` | 0 / 22,190,944 (0.00%) | 22,190,944 / 22,190,944 (100.00%) | 0 | _No valid value distribution available_ |
| `tox_threat` | 0 / 22,190,944 (0.00%) | 22,190,944 / 22,190,944 (100.00%) | 0 | _No valid value distribution available_ |
| `tox_insult` | 0 / 22,190,944 (0.00%) | 22,190,944 / 22,190,944 (100.00%) | 0 | _No valid value distribution available_ |
| `tox_identity_attack` | 0 / 22,190,944 (0.00%) | 22,190,944 / 22,190,944 (100.00%) | 0 | _No valid value distribution available_ |
| `count_misinfo` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 2 | `0` (22,184,287; 99.97%)<br>`1` (6,657; 0.03%) |
| `misinfo_score` | 0 / 22,190,944 (0.00%) | 22,190,944 / 22,190,944 (100.00%) | 0 | _No valid value distribution available_ |
| `political_score` | 21,375,797 / 22,190,944 (96.33%) | 815,147 / 22,190,944 (3.67%) | 658 | `1` (13,566,804; 61.14%)<br>`0` (4,706,699; 21.21%)<br>`0.9995` (820,325; 3.70%)<br>`0.999` (244,100; 1.10%)<br>`0.0001` (137,584; 0.62%)<br>`0.9985` (130,187; 0.59%)<br>`0.998` (96,161; 0.43%)<br>`0.9976` (76,929; 0.35%) |
| `is_political` | 21,375,797 / 22,190,944 (96.33%) | 815,147 / 22,190,944 (3.67%) | 2 | `t` (15,603,932; 70.32%)<br>`f` (5,771,865; 26.01%) |
| `created_at_timestamp` | 22,190,944 / 22,190,944 (100.00%) | 0 / 22,190,944 (0.00%) | 203 | `2026-01-17 23:21:47.830751` (662,030; 2.98%)<br>`2026-01-17 23:22:30.157748` (633,182; 2.85%)<br>`2026-01-17 23:21:07.535196` (630,223; 2.84%)<br>`2026-01-17 23:20:35.07244` (523,706; 2.36%)<br>`2026-01-17 23:20:08.941788` (409,793; 1.85%)<br>`2026-01-17 23:18:44.009837` (378,725; 1.71%)<br>`2026-01-17 23:19:47.079299` (366,151; 1.65%)<br>`2026-01-17 23:19:06.576321` (355,795; 1.60%) |

### Constraints

| Name | Type | Definition |
|---|---|---|
| `posts_lid_fkey` | Foreign key | `FOREIGN KEY (lid) REFERENCES legislators(lid) ON DELETE CASCADE` |
| `posts_topic_fkey` | Foreign key | `FOREIGN KEY (topic) REFERENCES topics(topic) ON DELETE RESTRICT` |
| `posts_pkey` | Primary key | `PRIMARY KEY (id)` |

### Indexes

| Name | Definition |
|---|---|
| `idx_posts_count_misinfo` | `CREATE INDEX idx_posts_count_misinfo ON public.posts USING btree (count_misinfo) WHERE (count_misinfo > 0)` |
| `idx_posts_created_at` | `CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at)` |
| `idx_posts_lid` | `CREATE INDEX idx_posts_lid ON public.posts USING btree (lid)` |
| `idx_posts_lid_date` | `CREATE INDEX idx_posts_lid_date ON public.posts USING btree (lid, created_at)` |
| `idx_posts_topic` | `CREATE INDEX idx_posts_topic ON public.posts USING btree (topic)` |
| `idx_posts_topic_probability` | `CREATE INDEX idx_posts_topic_probability ON public.posts USING btree (topic, topic_probability) WHERE (topic_probability IS NOT NULL)` |
| `idx_posts_tox_severe_toxicity` | `CREATE INDEX idx_posts_tox_severe_toxicity ON public.posts USING btree (tox_severe_toxicity) WHERE (tox_severe_toxicity IS NOT NULL)` |
| `idx_posts_tox_toxicity` | `CREATE INDEX idx_posts_tox_toxicity ON public.posts USING btree (tox_toxicity) WHERE (tox_toxicity IS NOT NULL)` |
| `idx_posts_tweet_id` | `CREATE INDEX idx_posts_tweet_id ON public.posts USING btree (tweet_id) WHERE (tweet_id IS NOT NULL)` |
| `posts_pkey` | `CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (id)` |

### Example Rows

```json
[
  {
    "id": "3430",
    "tweet_id": "1214326852262625280",
    "lid": "821531827579949056",
    "created_at": "2020-01-06T05:00:00.000Z",
    "text": "The California Green New Deal will help to reduce greenhouse gas emissions in order to avoid catastrophic consequences of climate change while also addressing economic inequality and racial injustices. #GreenNewDeal @Ro...",
    "retweet_count": "7",
    "like_count": "22",
    "reply_count": "0",
    "quote_count": "0",
    "favorite_count": "0",
    "topic": "7",
    "topic_probability": "0.9863",
    "topic_confidence": "0.9863",
    "tox_toxicity": null,
    "tox_severe_toxicity": null,
    "tox_obscene": null,
    "tox_threat": null,
    "tox_insult": null,
    "tox_identity_attack": null,
    "count_misinfo": "0",
    "misinfo_score": null,
    "political_score": "1",
    "is_political": "true",
    "created_at_timestamp": "2026-01-18T04:05:38.836Z"
  },
  {
    "id": "3431",
    "tweet_id": "1214290147354656768",
    "lid": "1125498438798401536",
    "created_at": "2020-01-06T05:00:00.000Z",
    "text": "RT @KansenChu: Happening now! Happy to stand along side with my colleagues as a co-author of Assemblymember Rob Bonta\u0019s Green New Deal legi&",
    "retweet_count": "2",
    "like_count": "0",
    "reply_count": "0",
    "quote_count": "0",
    "favorite_count": "0",
    "topic": "14",
    "topic_probability": "0.6602",
    "topic_confidence": "0.6602",
    "tox_toxicity": null,
    "tox_severe_toxicity": null,
    "tox_obscene": null,
    "tox_threat": null,
    "tox_insult": null,
    "tox_identity_attack": null,
    "count_misinfo": "0",
    "misinfo_score": null,
    "political_score": "1",
    "is_political": "true",
    "created_at_timestamp": "2026-01-18T04:05:38.836Z"
  },
  {
    "id": "3432",
    "tweet_id": "1214244441445167104",
    "lid": "1125498438798401536",
    "created_at": "2020-01-06T05:00:00.000Z",
    "text": "RT @AssemblyDems: During recess, our Members have received input from constituents on how to better their communities. Now they're #Backi&",
    "retweet_count": "4",
    "like_count": "0",
    "reply_count": "0",
    "quote_count": "0",
    "favorite_count": "0",
    "topic": "14",
    "topic_probability": "0.5942",
    "topic_confidence": "0.5942",
    "tox_toxicity": null,
    "tox_severe_toxicity": null,
    "tox_obscene": null,
    "tox_threat": null,
    "tox_insult": null,
    "tox_identity_attack": null,
    "count_misinfo": "0",
    "misinfo_score": null,
    "political_score": "1",
    "is_political": "true",
    "created_at_timestamp": "2026-01-18T04:05:38.836Z"
  }
]
```

## public.topics

- Type: Base table
- Rows: exact 22
- Total relation size: 32.0 KB

### Fields

| # | Field | Type | Nullable | Default / Generated | Constraints | Example contents |
|---:|---|---|---|---|---|---|
| 1 | `topic` | `text` | No |  | PK: topics_pkey | `0`<br>`1`<br>`15`<br>`14`<br>`999` |
| 2 | `topic_label` | `text` | No |  |  | `Unclassified`<br>`Macroeconomics`<br>`Banking, Finance, and Domestic Commerce`<br>`Housing`<br>`Unknown Topic (999)` |
| 3 | `created_at` | `timestamp without time zone` | Yes | Default: CURRENT_TIMESTAMP |  | `2026-01-18T04:01:35.624Z`<br>`2026-01-18T04:05:38.251Z` |

### EDA Population Ratios

Exact full-population counts over this stored relation. Valid text values exclude SQL nulls, blanks, and common pseudo-missing tokens such as `NaN`, `NA`, `N/A`, `null`, `none`, and `|NA|NA|NA`.

| Field | Valid Population | Invalid / Missing | Distinct Valid Values | Top Valid Values by Population Ratio |
|---|---:|---:|---:|---|
| `topic` | 22 / 22 (100.00%) | 0 / 22 (0.00%) | 22 | `0` (1; 4.55%)<br>`1` (1; 4.55%)<br>`10` (1; 4.55%)<br>`12` (1; 4.55%)<br>`13` (1; 4.55%)<br>`14` (1; 4.55%)<br>`15` (1; 4.55%)<br>`16` (1; 4.55%) |
| `topic_label` | 22 / 22 (100.00%) | 0 / 22 (0.00%) | 22 | `Agriculture` (1; 4.55%)<br>`Banking, Finance, and Domestic Commerce` (1; 4.55%)<br>`Civil Rights` (1; 4.55%)<br>`Culture` (1; 4.55%)<br>`Defense` (1; 4.55%)<br>`Education` (1; 4.55%)<br>`Energy` (1; 4.55%)<br>`Environment` (1; 4.55%) |
| `created_at` | 22 / 22 (100.00%) | 0 / 22 (0.00%) | 2 | `2026-01-18T04:05:38.251Z` (21; 95.45%)<br>`2026-01-18T04:01:35.624Z` (1; 4.55%) |

### Constraints

| Name | Type | Definition |
|---|---|---|
| `topics_pkey` | Primary key | `PRIMARY KEY (topic)` |

### Indexes

| Name | Definition |
|---|---|
| `topics_pkey` | `CREATE UNIQUE INDEX topics_pkey ON public.topics USING btree (topic)` |

### Example Rows

```json
[
  {
    "topic": "0",
    "topic_label": "Unclassified",
    "created_at": "2026-01-18T04:01:35.624Z"
  },
  {
    "topic": "1",
    "topic_label": "Macroeconomics",
    "created_at": "2026-01-18T04:05:38.251Z"
  },
  {
    "topic": "15",
    "topic_label": "Banking, Finance, and Domestic Commerce",
    "created_at": "2026-01-18T04:05:38.251Z"
  }
]
```

## public.topic_engagement_daily

- Type: Materialized view
- Rows: exact 27,790
- Total relation size: 2.5 MB

### Fields

| # | Field | Type | Nullable | Default / Generated | Constraints | Example contents |
|---:|---|---|---|---|---|---|
| 1 | `date` | `date` | Yes |  |  | `2020-01-01T05:00:00.000Z`<br>`2020-01-02T05:00:00.000Z`<br>`2020-01-03T05:00:00.000Z`<br>`2020-01-04T05:00:00.000Z`<br>`2020-01-05T05:00:00.000Z` |
| 2 | `topic` | `text` | Yes |  |  | `0`<br>`1`<br>`10`<br>`12`<br>`13` |
| 3 | `topic_label` | `text` | Yes |  |  | `Unclassified`<br>`Macroeconomics`<br>`Transportation`<br>`Law and Crime`<br>`Social Welfare` |
| 4 | `post_count` | `bigint` | Yes |  |  | `1`<br>`59`<br>`63`<br>`136`<br>`54` |
| 5 | `total_likes` | `bigint` | Yes |  |  | `14`<br>`675`<br>`517`<br>`1721`<br>`931` |
| 6 | `total_retweets` | `bigint` | Yes |  |  | `3`<br>`37332`<br>`2242`<br>`290614`<br>`69945` |
| 7 | `total_replies` | `bigint` | Yes |  |  | `0` |
| 8 | `total_quotes` | `bigint` | Yes |  |  | `0` |

### EDA Population Ratios

Exact full-population counts over this stored relation. Valid text values exclude SQL nulls, blanks, and common pseudo-missing tokens such as `NaN`, `NA`, `N/A`, `null`, `none`, and `|NA|NA|NA`.

| Field | Valid Population | Invalid / Missing | Distinct Valid Values | Top Valid Values by Population Ratio |
|---|---:|---:|---:|---|
| `date` | 27,790 / 27,790 (100.00%) | 0 / 27,790 (0.00%) | 1,327 | `2020-01-01T05:00:00.000Z` (22; 0.08%)<br>`2020-02-17T05:00:00.000Z` (22; 0.08%)<br>`2020-02-23T05:00:00.000Z` (22; 0.08%)<br>`2020-03-03T05:00:00.000Z` (22; 0.08%)<br>`2020-03-30T04:00:00.000Z` (22; 0.08%)<br>`2020-04-28T04:00:00.000Z` (22; 0.08%)<br>`2020-05-02T04:00:00.000Z` (22; 0.08%)<br>`2020-05-05T04:00:00.000Z` (22; 0.08%) |
| `topic` | 27,790 / 27,790 (100.00%) | 0 / 27,790 (0.00%) | 22 | `999` (1,325; 4.77%)<br>`1` (1,324; 4.76%)<br>`2` (1,324; 4.76%)<br>`20` (1,324; 4.76%)<br>`10` (1,323; 4.76%)<br>`12` (1,323; 4.76%)<br>`13` (1,323; 4.76%)<br>`19` (1,323; 4.76%) |
| `topic_label` | 27,790 / 27,790 (100.00%) | 0 / 27,790 (0.00%) | 22 | `Unknown Topic (999)` (1,325; 4.77%)<br>`Civil Rights` (1,324; 4.76%)<br>`Government Operations` (1,324; 4.76%)<br>`Macroeconomics` (1,324; 4.76%)<br>`International Affairs` (1,323; 4.76%)<br>`Law and Crime` (1,323; 4.76%)<br>`Social Welfare` (1,323; 4.76%)<br>`Transportation` (1,323; 4.76%) |
| `post_count` | 27,790 / 27,790 (100.00%) | 0 / 27,790 (0.00%) | 3,820 | `28` (157; 0.56%)<br>`14` (151; 0.54%)<br>`42` (147; 0.53%)<br>`33` (140; 0.50%)<br>`24` (137; 0.49%)<br>`30` (137; 0.49%)<br>`18` (136; 0.49%)<br>`40` (132; 0.47%) |
| `total_likes` | 27,790 / 27,790 (100.00%) | 0 / 27,790 (0.00%) | 14,335 | `0` (157; 0.56%)<br>`4` (33; 0.12%)<br>`10` (26; 0.09%)<br>`98` (25; 0.09%)<br>`63` (24; 0.09%)<br>`168` (24; 0.09%)<br>`2` (23; 0.08%)<br>`5` (23; 0.08%) |
| `total_retweets` | 27,790 / 27,790 (100.00%) | 0 / 27,790 (0.00%) | 23,425 | `0` (41; 0.15%)<br>`2` (25; 0.09%)<br>`6` (21; 0.08%)<br>`14` (17; 0.06%)<br>`40` (16; 0.06%)<br>`42` (16; 0.06%)<br>`3` (15; 0.05%)<br>`17` (15; 0.05%) |
| `total_replies` | 27,790 / 27,790 (100.00%) | 0 / 27,790 (0.00%) | 4,237 | `0` (13,802; 49.67%)<br>`6` (111; 0.40%)<br>`2` (107; 0.39%)<br>`4` (107; 0.39%)<br>`8` (94; 0.34%)<br>`12` (92; 0.33%)<br>`10` (91; 0.33%)<br>`16` (91; 0.33%) |
| `total_quotes` | 27,790 / 27,790 (100.00%) | 0 / 27,790 (0.00%) | 2,024 | `0` (14,701; 52.90%)<br>`2` (479; 1.72%)<br>`4` (425; 1.53%)<br>`6` (370; 1.33%)<br>`8` (265; 0.95%)<br>`14` (263; 0.95%)<br>`10` (233; 0.84%)<br>`12` (204; 0.73%) |

### Definition

```sql
SELECT p.created_at AS date,
    p.topic,
    t.topic_label,
    count(*) AS post_count,
    sum(p.like_count) AS total_likes,
    sum(p.retweet_count) AS total_retweets,
    sum(p.reply_count) AS total_replies,
    sum(p.quote_count) AS total_quotes
   FROM posts p
     JOIN topics t ON p.topic = t.topic
  GROUP BY p.created_at, p.topic, t.topic_label;
```

### Example Rows

```json
[
  {
    "date": "2020-01-01T05:00:00.000Z",
    "topic": "0",
    "topic_label": "Unclassified",
    "post_count": "1",
    "total_likes": "14",
    "total_retweets": "3",
    "total_replies": "0",
    "total_quotes": "0"
  },
  {
    "date": "2020-01-01T05:00:00.000Z",
    "topic": "1",
    "topic_label": "Macroeconomics",
    "post_count": "59",
    "total_likes": "675",
    "total_retweets": "37332",
    "total_replies": "0",
    "total_quotes": "0"
  },
  {
    "date": "2020-01-01T05:00:00.000Z",
    "topic": "10",
    "topic_label": "Transportation",
    "post_count": "63",
    "total_likes": "517",
    "total_retweets": "2242",
    "total_replies": "0",
    "total_quotes": "0"
  }
]
```

## public.topic_party_breakdown

- Type: Materialized view
- Rows: exact 66
- Total relation size: 24.0 KB

### Fields

| # | Field | Type | Nullable | Default / Generated | Constraints | Example contents |
|---:|---|---|---|---|---|---|
| 1 | `topic` | `text` | Yes |  |  | `0`<br>`1`<br>`10`<br>`12`<br>`13` |
| 2 | `topic_label` | `text` | Yes |  |  | `Unclassified`<br>`Macroeconomics`<br>`Transportation`<br>`Law and Crime`<br>`Social Welfare` |
| 3 | `party` | `text` | Yes |  |  | `Democratic`<br>`Independent`<br>`Republican` |
| 4 | `post_count` | `bigint` | Yes |  |  | `386959`<br>`2789`<br>`159802`<br>`303396`<br>`2092` |
| 5 | `total_likes` | `bigint` | Yes |  |  | `10134720`<br>`63022`<br>`10473580`<br>`6602240`<br>`23710` |
| 6 | `total_retweets` | `bigint` | Yes |  |  | `150653273`<br>`1230199`<br>`67256683`<br>`349577070`<br>`1490272` |
| 7 | `total_replies` | `bigint` | Yes |  |  | `0`<br>`317407`<br>`1602`<br>`885719`<br>`290148` |
| 8 | `total_quotes` | `bigint` | Yes |  |  | `0`<br>`94417`<br>`425`<br>`108838`<br>`62740` |

### EDA Population Ratios

Exact full-population counts over this stored relation. Valid text values exclude SQL nulls, blanks, and common pseudo-missing tokens such as `NaN`, `NA`, `N/A`, `null`, `none`, and `|NA|NA|NA`.

| Field | Valid Population | Invalid / Missing | Distinct Valid Values | Top Valid Values by Population Ratio |
|---|---:|---:|---:|---|
| `topic` | 66 / 66 (100.00%) | 0 / 66 (0.00%) | 22 | `0` (3; 4.55%)<br>`1` (3; 4.55%)<br>`10` (3; 4.55%)<br>`12` (3; 4.55%)<br>`13` (3; 4.55%)<br>`14` (3; 4.55%)<br>`15` (3; 4.55%)<br>`16` (3; 4.55%) |
| `topic_label` | 66 / 66 (100.00%) | 0 / 66 (0.00%) | 22 | `Agriculture` (3; 4.55%)<br>`Banking, Finance, and Domestic Commerce` (3; 4.55%)<br>`Civil Rights` (3; 4.55%)<br>`Culture` (3; 4.55%)<br>`Defense` (3; 4.55%)<br>`Education` (3; 4.55%)<br>`Energy` (3; 4.55%)<br>`Environment` (3; 4.55%) |
| `party` | 66 / 66 (100.00%) | 0 / 66 (0.00%) | 3 | `Democratic` (22; 33.33%)<br>`Independent` (22; 33.33%)<br>`Republican` (22; 33.33%) |
| `post_count` | 66 / 66 (100.00%) | 0 / 66 (0.00%) | 66 | `223` (1; 1.52%)<br>`268` (1; 1.52%)<br>`334` (1; 1.52%)<br>`778` (1; 1.52%)<br>`1184` (1; 1.52%)<br>`1256` (1; 1.52%)<br>`1310` (1; 1.52%)<br>`1315` (1; 1.52%) |
| `total_likes` | 66 / 66 (100.00%) | 0 / 66 (0.00%) | 66 | `1241` (1; 1.52%)<br>`1355` (1; 1.52%)<br>`3880` (1; 1.52%)<br>`4816` (1; 1.52%)<br>`4938` (1; 1.52%)<br>`8341` (1; 1.52%)<br>`9408` (1; 1.52%)<br>`10543` (1; 1.52%) |
| `total_retweets` | 66 / 66 (100.00%) | 0 / 66 (0.00%) | 66 | `14041` (1; 1.52%)<br>`17484` (1; 1.52%)<br>`83293` (1; 1.52%)<br>`103756` (1; 1.52%)<br>`167809` (1; 1.52%)<br>`229437` (1; 1.52%)<br>`326767` (1; 1.52%)<br>`442762` (1; 1.52%) |
| `total_replies` | 66 / 66 (100.00%) | 0 / 66 (0.00%) | 63 | `0` (4; 6.06%)<br>`89` (1; 1.52%)<br>`120` (1; 1.52%)<br>`147` (1; 1.52%)<br>`192` (1; 1.52%)<br>`224` (1; 1.52%)<br>`300` (1; 1.52%)<br>`356` (1; 1.52%) |
| `total_quotes` | 66 / 66 (100.00%) | 0 / 66 (0.00%) | 64 | `0` (3; 4.55%)<br>`15` (1; 1.52%)<br>`27` (1; 1.52%)<br>`40` (1; 1.52%)<br>`42` (1; 1.52%)<br>`52` (1; 1.52%)<br>`83` (1; 1.52%)<br>`85` (1; 1.52%) |

### Definition

```sql
SELECT p.topic,
    t.topic_label,
    l.party,
    count(*) AS post_count,
    sum(p.like_count) AS total_likes,
    sum(p.retweet_count) AS total_retweets,
    sum(p.reply_count) AS total_replies,
    sum(p.quote_count) AS total_quotes
   FROM posts p
     JOIN topics t ON p.topic = t.topic
     JOIN legislators l ON p.lid = l.lid
  WHERE l.party IS NOT NULL
  GROUP BY p.topic, t.topic_label, l.party;
```

### Example Rows

```json
[
  {
    "topic": "0",
    "topic_label": "Unclassified",
    "party": "Democratic",
    "post_count": "386959",
    "total_likes": "10134720",
    "total_retweets": "150653273",
    "total_replies": "0",
    "total_quotes": "0"
  },
  {
    "topic": "0",
    "topic_label": "Unclassified",
    "party": "Independent",
    "post_count": "2789",
    "total_likes": "63022",
    "total_retweets": "1230199",
    "total_replies": "0",
    "total_quotes": "0"
  },
  {
    "topic": "0",
    "topic_label": "Unclassified",
    "party": "Republican",
    "post_count": "159802",
    "total_likes": "10473580",
    "total_retweets": "67256683",
    "total_replies": "0",
    "total_quotes": "0"
  }
]
```

## public.topic_state_breakdown

- Type: Materialized view
- Rows: exact 1,100
- Total relation size: 144.0 KB

### Fields

| # | Field | Type | Nullable | Default / Generated | Constraints | Example contents |
|---:|---|---|---|---|---|---|
| 1 | `topic` | `text` | Yes |  |  | `0`<br>`1`<br>`10`<br>`12`<br>`13` |
| 2 | `topic_label` | `text` | Yes |  |  | `Unclassified`<br>`Macroeconomics`<br>`Transportation`<br>`Law and Crime`<br>`Social Welfare` |
| 3 | `state` | `text` | Yes |  |  | `AK`<br>`AL`<br>`AR`<br>`AZ`<br>`CA` |
| 4 | `post_count` | `bigint` | Yes |  |  | `963`<br>`4683`<br>`9317`<br>`31911`<br>`21340` |
| 5 | `total_likes` | `bigint` | Yes |  |  | `9244`<br>`75473`<br>`192586`<br>`5545773`<br>`2492960` |
| 6 | `total_retweets` | `bigint` | Yes |  |  | `263354`<br>`2213841`<br>`5831399`<br>`22020114`<br>`6394696` |
| 7 | `total_replies` | `bigint` | Yes |  |  | `0`<br>`408`<br>`232`<br>`8609`<br>`20124` |
| 8 | `total_quotes` | `bigint` | Yes |  |  | `0`<br>`46`<br>`81`<br>`2440`<br>`3697` |

### EDA Population Ratios

Exact full-population counts over this stored relation. Valid text values exclude SQL nulls, blanks, and common pseudo-missing tokens such as `NaN`, `NA`, `N/A`, `null`, `none`, and `|NA|NA|NA`.

| Field | Valid Population | Invalid / Missing | Distinct Valid Values | Top Valid Values by Population Ratio |
|---|---:|---:|---:|---|
| `topic` | 1,100 / 1,100 (100.00%) | 0 / 1,100 (0.00%) | 22 | `0` (50; 4.55%)<br>`1` (50; 4.55%)<br>`10` (50; 4.55%)<br>`12` (50; 4.55%)<br>`13` (50; 4.55%)<br>`14` (50; 4.55%)<br>`15` (50; 4.55%)<br>`16` (50; 4.55%) |
| `topic_label` | 1,100 / 1,100 (100.00%) | 0 / 1,100 (0.00%) | 22 | `Agriculture` (50; 4.55%)<br>`Banking, Finance, and Domestic Commerce` (50; 4.55%)<br>`Civil Rights` (50; 4.55%)<br>`Culture` (50; 4.55%)<br>`Defense` (50; 4.55%)<br>`Education` (50; 4.55%)<br>`Energy` (50; 4.55%)<br>`Environment` (50; 4.55%) |
| `state` | 1,100 / 1,100 (100.00%) | 0 / 1,100 (0.00%) | 50 | `AK` (22; 2.00%)<br>`AL` (22; 2.00%)<br>`AR` (22; 2.00%)<br>`AZ` (22; 2.00%)<br>`CA` (22; 2.00%)<br>`CO` (22; 2.00%)<br>`CT` (22; 2.00%)<br>`DE` (22; 2.00%) |
| `post_count` | 1,100 / 1,100 (100.00%) | 0 / 1,100 (0.00%) | 1,058 | `2527` (4; 0.36%)<br>`444` (3; 0.27%)<br>`168` (2; 0.18%)<br>`190` (2; 0.18%)<br>`257` (2; 0.18%)<br>`277` (2; 0.18%)<br>`421` (2; 0.18%)<br>`455` (2; 0.18%) |
| `total_likes` | 1,100 / 1,100 (100.00%) | 0 / 1,100 (0.00%) | 1,094 | `721` (2; 0.18%)<br>`1077` (2; 0.18%)<br>`12053` (2; 0.18%)<br>`21659` (2; 0.18%)<br>`51512` (2; 0.18%)<br>`73450` (2; 0.18%)<br>`16` (1; 0.09%)<br>`177` (1; 0.09%) |
| `total_retweets` | 1,100 / 1,100 (100.00%) | 0 / 1,100 (0.00%) | 1,100 | `435` (1; 0.09%)<br>`730` (1; 0.09%)<br>`1011` (1; 0.09%)<br>`2015` (1; 0.09%)<br>`2488` (1; 0.09%)<br>`2543` (1; 0.09%)<br>`2820` (1; 0.09%)<br>`3657` (1; 0.09%) |
| `total_replies` | 1,100 / 1,100 (100.00%) | 0 / 1,100 (0.00%) | 987 | `0` (52; 4.73%)<br>`78` (5; 0.45%)<br>`2` (3; 0.27%)<br>`102` (3; 0.27%)<br>`106` (3; 0.27%)<br>`731` (3; 0.27%)<br>`1041` (3; 0.27%)<br>`1080` (3; 0.27%) |
| `total_quotes` | 1,100 / 1,100 (100.00%) | 0 / 1,100 (0.00%) | 830 | `0` (62; 5.64%)<br>`2` (12; 1.09%)<br>`22` (10; 0.91%)<br>`53` (7; 0.64%)<br>`8` (6; 0.55%)<br>`10` (6; 0.55%)<br>`4` (5; 0.45%)<br>`17` (5; 0.45%) |

### Definition

```sql
SELECT p.topic,
    t.topic_label,
    l.state,
    count(*) AS post_count,
    sum(p.like_count) AS total_likes,
    sum(p.retweet_count) AS total_retweets,
    sum(p.reply_count) AS total_replies,
    sum(p.quote_count) AS total_quotes
   FROM posts p
     JOIN topics t ON p.topic = t.topic
     JOIN legislators l ON p.lid = l.lid
  WHERE l.state IS NOT NULL
  GROUP BY p.topic, t.topic_label, l.state;
```

### Example Rows

```json
[
  {
    "topic": "0",
    "topic_label": "Unclassified",
    "state": "AK",
    "post_count": "963",
    "total_likes": "9244",
    "total_retweets": "263354",
    "total_replies": "0",
    "total_quotes": "0"
  },
  {
    "topic": "0",
    "topic_label": "Unclassified",
    "state": "AL",
    "post_count": "4683",
    "total_likes": "75473",
    "total_retweets": "2213841",
    "total_replies": "0",
    "total_quotes": "0"
  },
  {
    "topic": "0",
    "topic_label": "Unclassified",
    "state": "AR",
    "post_count": "9317",
    "total_likes": "192586",
    "total_retweets": "5831399",
    "total_replies": "0",
    "total_quotes": "0"
  }
]
```

## public.legislator_summary

- Type: View
- Rows: not stored; computed when queried
- Total relation size: 0 B

### Fields

| # | Field | Type | Nullable | Default / Generated | Constraints | Example contents |
|---:|---|---|---|---|---|---|
| 1 | `lid` | `text` | Yes |  |  | `825008323548295168`<br>`2190582458`<br>`67438777`<br>`2917685440`<br>`1329453138026389504` |
| 2 | `name` | `text` | Yes |  |  | `@patwilliams4u`<br>`brad paquette`<br>`kera birkeland`<br>`rick hansen`<br>`nick pisciottano` |
| 3 | `handle` | `text` | Yes |  |  | `patwilliams4u`<br>`PaquetteBrad18`<br>`KeraBirk`<br>`reprickhansen`<br>`NickforPA` |
| 4 | `state` | `text` | Yes |  |  | `MI`<br>`UT`<br>`MN`<br>`PA`<br>`NH` |
| 5 | `chamber` | `text` | Yes |  |  | `H`<br>`S` |
| 6 | `party` | `text` | Yes |  |  | `Republican`<br>`Democratic` |
| 7 | `total_posts` | `bigint` | Yes |  |  | `55`<br>`3405`<br>`1419`<br>`40342`<br>`1232` |
| 8 | `total_likes` | `bigint` | Yes |  |  | `94`<br>`15891`<br>`14426`<br>`69451`<br>`7991` |
| 9 | `total_retweets` | `bigint` | Yes |  |  | `4938`<br>`11476597`<br>`291605`<br>`28551612`<br>`4305` |
| 10 | `total_replies` | `bigint` | Yes |  |  | `0`<br>`3029`<br>`4428`<br>`1827`<br>`778` |
| 11 | `total_quotes` | `bigint` | Yes |  |  | `0`<br>`630`<br>`318`<br>`702`<br>`192` |
| 12 | `first_post_date` | `date` | Yes |  |  | `2020-01-21T05:00:00.000Z`<br>`2020-01-25T05:00:00.000Z`<br>`2020-12-31T05:00:00.000Z`<br>`2020-01-01T05:00:00.000Z`<br>`2023-01-11T05:00:00.000Z` |
| 13 | `last_post_date` | `date` | Yes |  |  | `2022-02-23T05:00:00.000Z`<br>`2024-11-28T05:00:00.000Z`<br>`2024-11-17T05:00:00.000Z`<br>`2024-12-05T05:00:00.000Z`<br>`2024-08-27T04:00:00.000Z` |

### EDA Population Ratios

Sample-based profile from the first 500 rows returned by the relation. Valid text values exclude SQL nulls, blanks, and common pseudo-missing tokens such as `NaN`, `NA`, `N/A`, `null`, `none`, and `|NA|NA|NA`.

| Field | Valid Population | Invalid / Missing | Distinct Valid Values | Top Valid Values by Population Ratio |
|---|---:|---:|---:|---|
| `lid` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 500 | `1000136281408466944` (1; 0.20%)<br>`1004891731` (1; 0.20%)<br>`1005649258975055872` (1; 0.20%)<br>`1008768166489706496` (1; 0.20%)<br>`1009608075295068160` (1; 0.20%)<br>`101273716` (1; 0.20%)<br>`1013684630` (1; 0.20%)<br>`1024854955` (1; 0.20%) |
| `name` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 500 | `@alexishansenNV` (1; 0.20%)<br>`@AnnaEfor148` (1; 0.20%)<br>`@AsaHutchinson` (1; 0.20%)<br>`@ashleyforAR` (1; 0.20%)<br>`@AsmCervantes` (1; 0.20%)<br>`@AssemblyKen` (1; 0.20%)<br>`@ASWCarter` (1; 0.20%)<br>`@BonnieRichForGa` (1; 0.20%) |
| `handle` | 475 / 500 (95.00%) | 25 / 500 (5.00%) | 475 | `_rjayrodriguez` (1; 0.20%)<br>`AChaparro33` (1; 0.20%)<br>`Adam_Morfeld` (1; 0.20%)<br>`alexishansenNV` (1; 0.20%)<br>`AlexJoers` (1; 0.20%)<br>`alformontana` (1; 0.20%)<br>`AmandaSeptimo` (1; 0.20%)<br>`AmyforStateRep` (1; 0.20%) |
| `state` | 313 / 500 (62.60%) | 187 / 500 (37.40%) | 46 | `PA` (17; 3.40%)<br>`MD` (14; 2.80%)<br>`MN` (14; 2.80%)<br>`CA` (13; 2.60%)<br>`MO` (13; 2.60%)<br>`FL` (12; 2.40%)<br>`IL` (10; 2.00%)<br>`MA` (10; 2.00%) |
| `chamber` | 313 / 500 (62.60%) | 187 / 500 (37.40%) | 2 | `H` (209; 41.80%)<br>`S` (104; 20.80%) |
| `party` | 313 / 500 (62.60%) | 187 / 500 (37.40%) | 2 | `Democratic` (170; 34.00%)<br>`Republican` (143; 28.60%) |
| `total_posts` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 428 | `2` (10; 2.00%)<br>`1` (9; 1.80%)<br>`10` (4; 0.80%)<br>`12` (4; 0.80%)<br>`16` (4; 0.80%)<br>`7` (4; 0.80%)<br>`14` (3; 0.60%)<br>`184` (3; 0.60%) |
| `total_likes` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 446 | `0` (23; 4.60%)<br>`1` (7; 1.40%)<br>`2` (4; 0.80%)<br>`4` (3; 0.60%)<br>`6` (3; 0.60%)<br>`9` (3; 0.60%)<br>`101` (2; 0.40%)<br>`106` (2; 0.40%) |
| `total_retweets` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 465 | `0` (15; 3.00%)<br>`2` (5; 1.00%)<br>`5` (3; 0.60%)<br>`1` (2; 0.40%)<br>`11` (2; 0.40%)<br>`12171` (2; 0.40%)<br>`15` (2; 0.40%)<br>`16` (2; 0.40%) |
| `total_replies` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 270 | `0` (192; 38.40%)<br>`4` (5; 1.00%)<br>`31` (4; 0.80%)<br>`5` (4; 0.80%)<br>`9` (4; 0.80%)<br>`1` (3; 0.60%)<br>`12` (3; 0.60%)<br>`28` (3; 0.60%) |
| `total_quotes` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 214 | `0` (218; 43.60%)<br>`1` (12; 2.40%)<br>`2` (12; 2.40%)<br>`4` (8; 1.60%)<br>`42` (5; 1.00%)<br>`11` (4; 0.80%)<br>`26` (4; 0.80%)<br>`6` (4; 0.80%) |
| `first_post_date` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 142 | `2020-01-01T05:00:00.000Z` (116; 23.20%)<br>`2020-01-02T05:00:00.000Z` (33; 6.60%)<br>`2020-01-03T05:00:00.000Z` (22; 4.40%)<br>`2024-08-29T04:00:00.000Z` (20; 4.00%)<br>`2020-01-04T05:00:00.000Z` (13; 2.60%)<br>`2020-01-08T05:00:00.000Z` (13; 2.60%)<br>`2020-01-06T05:00:00.000Z` (12; 2.40%)<br>`2021-01-25T05:00:00.000Z` (10; 2.00%) |
| `last_post_date` | 500 / 500 (100.00%) | 0 / 500 (0.00%) | 212 | `2022-02-23T05:00:00.000Z` (35; 7.00%)<br>`2024-11-28T05:00:00.000Z` (32; 6.40%)<br>`2024-12-05T05:00:00.000Z` (26; 5.20%)<br>`2024-11-05T05:00:00.000Z` (19; 3.80%)<br>`2024-11-25T05:00:00.000Z` (14; 2.80%)<br>`2022-02-22T05:00:00.000Z` (12; 2.40%)<br>`2024-11-13T05:00:00.000Z` (11; 2.20%)<br>`2024-11-17T05:00:00.000Z` (11; 2.20%) |

### Definition

```sql
SELECT l.lid,
    l.name,
    l.handle,
    l.state,
    l.chamber,
    l.party,
    count(p.id) AS total_posts,
    sum(p.like_count) AS total_likes,
    sum(p.retweet_count) AS total_retweets,
    sum(p.reply_count) AS total_replies,
    sum(p.quote_count) AS total_quotes,
    min(p.created_at) AS first_post_date,
    max(p.created_at) AS last_post_date
   FROM legislators l
     LEFT JOIN posts p ON l.lid = p.lid
  GROUP BY l.lid, l.name, l.handle, l.state, l.chamber, l.party;
```

### Example Rows

```json
[
  {
    "lid": "825008323548295168",
    "name": "@patwilliams4u",
    "handle": "patwilliams4u",
    "state": null,
    "chamber": null,
    "party": null,
    "total_posts": "55",
    "total_likes": "94",
    "total_retweets": "4938",
    "total_replies": "0",
    "total_quotes": "0",
    "first_post_date": "2020-01-21T05:00:00.000Z",
    "last_post_date": "2022-02-23T05:00:00.000Z"
  },
  {
    "lid": "2190582458",
    "name": "brad paquette",
    "handle": "PaquetteBrad18",
    "state": "MI",
    "chamber": "H",
    "party": "Republican",
    "total_posts": "3405",
    "total_likes": "15891",
    "total_retweets": "11476597",
    "total_replies": "3029",
    "total_quotes": "630",
    "first_post_date": "2020-01-25T05:00:00.000Z",
    "last_post_date": "2024-11-28T05:00:00.000Z"
  },
  {
    "lid": "67438777",
    "name": "kera birkeland",
    "handle": "KeraBirk",
    "state": "UT",
    "chamber": "H",
    "party": "Republican",
    "total_posts": "1419",
    "total_likes": "14426",
    "total_retweets": "291605",
    "total_replies": "4428",
    "total_quotes": "318",
    "first_post_date": "2020-12-31T05:00:00.000Z",
    "last_post_date": "2024-11-17T05:00:00.000Z"
  }
]
```

## Sequences

### public.posts_id_seq

| Property | Value |
|---|---|
| schemaname | `public` |
| sequencename | `posts_id_seq` |
| sequenceowner | `postgres` |
| data_type | `bigint` |
| start_value | `1` |
| min_value | `1` |
| max_value | `9223372036854775807` |
| increment_by | `1` |
| cycle | `false` |
| cache_size | `1` |
| last_value | `22177134` |

