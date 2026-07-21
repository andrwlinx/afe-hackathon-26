import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 960 },
  { name: "mobile", width: 390, height: 844 }
]) {
  test(`${viewport.name} 3D answer path is usable and rendered`, async ({
    page
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/ramppath");
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
        bodyFont: expect.stringContaining("Amazon Ember"),
        headingFont: expect.stringContaining("Amazon Ember"),
        primaryRadius: "999px 999px 999px 999px",
        brandColor: "rgb(23, 104, 201)",
        noHorizontalOverflow: true
      });

    await page
      .getByLabel("Example questions")
      .selectOption({ label: "Check my access" });
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
    expect(bounds?.height).toBeGreaterThan(450);

    const canvas = graph.locator("canvas");
    await expect(canvas).toBeVisible();
    const graphLabels = graph.locator(".graph-label-layer span");
    await expect(graphLabels.first()).toBeVisible();
    expect(
      await graphLabels.first().evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize)
      )
    ).toBeGreaterThanOrEqual(viewport.name === "mobile" ? 10 : 11);
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const graphCanvas = element as HTMLCanvasElement;
          const gl =
            graphCanvas.getContext("webgl2") ??
            graphCanvas.getContext("webgl");
          if (!gl || gl.drawingBufferWidth === 0 || gl.drawingBufferHeight === 0) {
            return 0;
          }
          const pixels = new Uint8Array(
            gl.drawingBufferWidth * gl.drawingBufferHeight * 4
          );
          gl.readPixels(
            0,
            0,
            gl.drawingBufferWidth,
            gl.drawingBufferHeight,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels
          );
          let nonBackgroundPixels = 0;
          for (let index = 0; index < pixels.length; index += 64) {
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const alpha = pixels[index + 3];
            if (
              alpha > 0 &&
              (Math.abs(red - 247) > 8 ||
                Math.abs(green - 248) > 8 ||
                Math.abs(blue - 250) > 8)
            ) {
              nonBackgroundPixels += 1;
            }
          }
          return nonBackgroundPixels;
        })
      )
      .toBeGreaterThan(20);

    const operatorButton = page
      .getByLabel("Path entities")
      .getByRole("button", { name: /AtlasProdOperator/ });
    await operatorButton.click();
    await expect(page.locator(".node-inspector h3")).toContainText(
      "AtlasProdOperator"
    );
    await expect(
      page.locator(".connection-list").getByText(/missing role access/)
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset graph view" })).toBeVisible();

    const evidence = page.locator(".evidence-panel");
    await expect(evidence).not.toHaveAttribute("open", "");
    await evidence.locator("summary").click();
    await expect(
      evidence.getByText("bindle", { exact: true }).first()
    ).toBeVisible();

    await page
      .getByLabel("Example questions")
      .selectOption({ label: "Find the right person" });
    await expect(
      page.getByRole("heading", {
        name: /Jordan Rivera is the strongest match/
      })
    ).toBeVisible();
    await expect(
      page.getByText("Who to ask first", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Matched resources", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("100 percent relevance")).toBeVisible();

    const why = page
      .getByText("Why this person", { exact: true })
      .first();
    await why.click();
    await expect(page.getByText(/relationship/).first()).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      )
      .toBe(true);

    await page.screenshot({
      path: `test-results/ramp-path-3d-${viewport.name}.png`,
      fullPage: true
    });
  });
}

test("Phone Tool page links into RampPath", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(page.getByText("Phone Tool", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jane Doe" })).toBeVisible();

  await page.getByRole("link", { name: /Find a resource/ }).click();
  await expect(page).toHaveURL(/\/ramppath$/);
  await expect(page.getByText("RampPath", { exact: true })).toBeVisible();
});

test("plain-text ownership query offers clickable options", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/ramppath");

  await page.getByLabel("What do you need to unblock?").fill("Who owns metrics?");
  await page.getByRole("button", { name: /Trace answer/ }).click();
  await expect(
    page.getByRole("heading", { name: /Multiple resources match/ })
  ).toBeVisible();

  await page.getByRole("button", { name: "Who owns AtlasMetricsSDK?" }).click();
  await expect(
    page.getByRole("heading", { name: /AtlasMetricsSDK is owned by/ })
  ).toBeVisible();
});
