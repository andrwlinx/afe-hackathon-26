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
    await expect
      .poll(() =>
        page.locator("body").evaluate((element) => {
          const bodyFont = getComputedStyle(element).fontFamily;
          const headingFont = getComputedStyle(
            document.querySelector(".brand strong")!
          ).fontFamily;
          const primary = getComputedStyle(
            document.querySelector(".primary-button")!
          );
          const brand = getComputedStyle(
            document.querySelector(".brand-mark")!
          );
          return {
            bodyFont,
            headingFont,
            primaryRadius: [
              primary.borderTopLeftRadius,
              primary.borderTopRightRadius,
              primary.borderBottomRightRadius,
              primary.borderBottomLeftRadius
            ].join(" "),
            brandColor: brand.backgroundColor,
            noHorizontalOverflow:
              document.documentElement.scrollWidth <= window.innerWidth
          };
        })
      )
      .toEqual({
        bodyFont: expect.stringContaining("Source Sans 3"),
        headingFont: expect.stringContaining("IBM Plex Sans Condensed"),
        primaryRadius: "2px 6px 6px 2px",
        brandColor: "rgb(20, 125, 114)",
        noHorizontalOverflow: true
      });

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

    await page.getByRole("button", { name: /Find the right person/ }).click();
    await expect(
      page.getByRole("heading", { name: /Jordan Rivera is the strongest match/ })
    ).toBeVisible();
    await expect(page.getByText("Who to ask first", { exact: true })).toBeVisible();
    await expect(page.getByText("Why this person", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("100 percent relevance")).toBeVisible();

    await page.screenshot({
      path: `test-results/ramp-path-${viewport.name}.png`,
      fullPage: true
    });
  });
}
