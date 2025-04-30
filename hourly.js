    // 👇 Go to Apollo credit usage page and wait
    await page.goto('https://app.apollo.io/#/settings/credits/current', { timeout: 30000 });
    await page.waitForTimeout(5000);

    // 👇 Extract text like "5520 credits of 60240 credits / mo"
    const creditText = await page.locator('text=/\\d+ credits of \\d+ credits/').first().textContent();

    const creditMatch = creditText?.match(/(\d+)\s+credits\s+of\s+(\d+)\s+credits/);
    if (!creditMatch) throw new Error(`Unable to extract credit values from text: "${creditText}"`);

    const used = parseInt(creditMatch[1], 10);
    const limit = parseInt(creditMatch[2], 10);

    console.log(`📊 Extracted from page — Used: ${used}, Limit: ${limit}`);

    const result = { used, limit, source: 'dom', timestamp: new Date().toISOString() };
    fs.writeFileSync(path.join(screenshotDir, 'result.json'), JSON.stringify(result, null, 2));

    // Save a screenshot of the page as well
    await page.screenshot({ path: path.join(screenshotDir, 'apollo-credits-page.png'), fullPage: true });

    console.log("✅ DOM data and screenshot saved.");
