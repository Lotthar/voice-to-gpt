import fs from "fs/promises";

export const saveArrayToJsonFile = async (array, filePath) => {
  try {
    const jsonString = JSON.stringify(array, null, 2);
    await fs.writeFile(filePath, jsonString, "utf-8");
    console.log(`Successfully saved array to ${filePath}`);
  } catch (error) {
    console.error("Error saving array to JSON file:", error);
  }
};

export const readArrayFromJsonFile = async (filePath) => {
  try {
    const jsonString = await fs.readFile(filePath, "utf-8");
    const array = JSON.parse(jsonString);
    console.log(`Successfully read array from ${filePath}`);
    return array;
  } catch (error) {
    console.log("Error reading array from JSON file:", error);
    return null;
  }
};
