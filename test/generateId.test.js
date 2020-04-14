const generateId = require("../src/generateId");

describe("generateId", () => {
  test("should generate a random id with length 10", () => {
    const id = generateId(10);

    expect(id).toMatch(/[a-zA-Z0-9]{10}/);
  });

  test("should generate a empty string with length <= 0", () => {
    const id = generateId(-1);

    expect(id).toEqual("");
  });
});
