import * as d3 from "d3";

async function getIndividualCSV(path) {
  let loadedData = await d3.csv(path);
  return loadedData;
}

export async function getCSV(paths) {
  const promises = paths.map((path) => getIndividualCSV(path));
  const results = await Promise.all(promises);
  return results;
}

async function getIndividualJSON(path) {
  let loadedData = await d3.json(path);
  return loadedData;
}

export async function getJSON(paths) {
  const promises = paths.map((path) => getIndividualJSON(path));
  const results = await Promise.all(promises);
  return results;
}