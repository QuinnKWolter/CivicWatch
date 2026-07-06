export type CivicEvent = {
  eventId: string;
  name: string;
  category: string;
  startDate: string;
  endDate?: string;
  contextNote: string;
};

export const events: CivicEvent[] = [
  ['2020-02-05', 'First Trump impeachment: Senate acquittal', 'federal_politics'],
  ['2020-03-11', 'COVID-19 declared a pandemic; U.S. national emergency', 'crises', '2020-03-13'],
  ['2020-05-25', 'George Floyd killed; nationwide protests', 'crises', '2020-06-07'],
  ['2020-09-18', 'Justice Ruth Bader Ginsburg dies', 'federal_politics'],
  ['2020-10-26', 'Amy Coney Barrett confirmed to SCOTUS', 'federal_politics'],
  ['2020-11-03', '2020 general election', 'elections'],
  ['2020-12-14', 'First U.S. COVID-19 vaccinations', 'crises'],
  ['2021-01-06', 'Capitol attack', 'federal_politics'],
  ['2021-01-13', 'Second Trump impeachment (House)', 'federal_politics'],
  ['2021-01-20', 'Biden inauguration', 'federal_politics'],
  ['2021-03-11', 'American Rescue Plan Act signed', 'legislation'],
  ['2021-08-15', 'Kabul falls; U.S. withdrawal from Afghanistan', 'crises', '2021-08-30'],
  ['2021-09-01', 'Texas SB 8 (abortion) takes effect', 'legislation'],
  ['2021-11-15', 'Infrastructure Investment and Jobs Act signed', 'legislation'],
  ['2022-02-24', 'Russian invasion of Ukraine', 'crises'],
  ['2022-05-14', 'Buffalo grocery store mass shooting', 'mass_violence'],
  ['2022-05-24', 'Uvalde school shooting', 'mass_violence'],
  ['2022-06-24', 'Dobbs decision overturns Roe v. Wade', 'scotus'],
  ['2022-06-25', 'Bipartisan Safer Communities Act signed', 'legislation'],
  ['2022-08-08', 'Mar-a-Lago FBI search', 'federal_politics'],
  ['2022-08-16', 'Inflation Reduction Act signed', 'legislation'],
  ['2022-11-08', '2022 midterm elections', 'elections'],
  ['2023-01-03', 'Kevin McCarthy speaker vote saga', 'federal_politics', '2023-01-07'],
  ['2023-02-03', 'East Palestine, Ohio train derailment', 'crises'],
  ['2023-03-27', 'Covenant School shooting, Nashville', 'mass_violence'],
  ['2023-04-06', 'Tennessee House expels state Reps. Jones and Pearson', 'legislative_institution'],
  ['2023-06-29', 'SCOTUS ends race-based college admissions (SFFA)', 'scotus'],
  ['2023-08-08', 'Maui / Lahaina wildfires begin', 'crises'],
  ['2023-10-07', 'Hamas attack on Israel', 'crises'],
  ['2023-10-25', 'Lewiston, Maine mass shooting', 'mass_violence'],
  ['2024-03-26', 'Baltimore Key Bridge collapse', 'crises'],
  ['2024-07-01', 'SCOTUS presidential immunity ruling (Trump v. United States)', 'scotus'],
  ['2024-07-13', 'Trump assassination attempt, Butler, PA', 'federal_politics'],
  ['2024-07-21', 'Biden withdraws from presidential race', 'federal_politics'],
  ['2024-09-26', 'Hurricane Helene', 'crises', '2024-09-30'],
  ['2024-10-09', 'Hurricane Milton', 'crises'],
  ['2024-11-05', '2024 general election', 'elections']
].map(([startDate, name, category, endDate], index) => ({
  eventId: `event_${String(index + 1).padStart(2, '0')}`,
  name,
  category,
  startDate,
  endDate,
  contextNote: 'Curated event marker from the CivicWatch design document.'
}));
