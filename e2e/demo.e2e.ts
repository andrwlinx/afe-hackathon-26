import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 960 },
  { name: "mobile", width: 390, height: 844 }
]) {
  test(`${viewport.name} access path is visible and rendered`, async ({
    page
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByText("RampPath", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Check my access/ }).click();
    await expect(
      page.getByRole("heading", { name: /missing AtlasProdOperator/ })
    ).toBeVisible();
    await expect(
      page.getByText("Ask Priya Shah for AtlasProdOperator.", { exact: true })
    ).toBeVisible();

    const graph = page.locator(".graph-canvas");
    await expect(graph).toBeVisible();
    const bounds = await graph.boundingBox();
    expect(bounds?.width).toBeGreaterThan(300);
    expect(bounds?.height).toBeGreaterThan(280);

    await expect
      .poll(async () =>
        graph.locator("canvas").evaluateAll((canvases) =>
          canvases.some((canvas) => {
            const context = canvas.getContext("2d");
            if (!context || canvas.width === 0 || canvas.height === 0) return false;
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            ).data;
            for (let index = 3; index < pixels.length; index += 64) {
              if (pixels[index] > 0) return true;
            }
            return false;
          })
        )
      )
      .toBe(true);

    await page.screenshot({
      path: `test-results/ramp-path-${viewport.name}.png`,
      fullPage: true
    });
  });
}
