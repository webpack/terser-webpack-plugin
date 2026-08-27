import MinimizerPlugin from "../src";

// The error paths need no `imagemin` install: each one refuses before, or
// because, a plugin could not be loaded.

describe("imageminNormalizeConfig", () => {
  it("should throw when no configuration is given", async () => {
    await expect(MinimizerPlugin.imageminNormalizeConfig()).rejects.toThrow(
      "No plugins found for `imagemin`, please read documentation",
    );
  });

  it("should throw when the `plugins` list is empty", async () => {
    await expect(
      MinimizerPlugin.imageminNormalizeConfig({ plugins: [] }),
    ).rejects.toThrow("No plugins found for `imagemin`");
  });

  it("should throw when `plugins` is not a list", async () => {
    await expect(
      MinimizerPlugin.imageminNormalizeConfig({ plugins: 42 }),
    ).rejects.toThrow("No plugins found for `imagemin`");
  });

  it.each([
    ["a number", [42]],
    ["an empty pair", [[]]],
    ["an object", [{ name: "svgo" }]],
  ])("should throw when a plugin is %s", async (_name, plugins) => {
    await expect(
      MinimizerPlugin.imageminNormalizeConfig({ plugins }),
    ).rejects.toThrow(/Invalid plugin configuration/);
  });

  it("should throw naming the package to install when a plugin is missing", async () => {
    await expect(
      MinimizerPlugin.imageminNormalizeConfig({ plugins: ["no-such-plugin"] }),
    ).rejects.toThrow("Unknown plugin: imagemin-no-such-plugin");
  });

  it("should not prefix a name that already starts with `imagemin`", async () => {
    await expect(
      MinimizerPlugin.imageminNormalizeConfig({
        plugins: ["imagemin-no-such-plugin"],
      }),
    ).rejects.toThrow("Unknown plugin: imagemin-no-such-plugin");
  });
});
