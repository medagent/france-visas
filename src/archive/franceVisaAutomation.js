import puppeteer from "puppeteer";

export function delay(time) {
  console.log(`Delaying for ${time}ms...`);
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

export async function waitAndClick(page, selector, timeout = 30000) {
  try {
    console.log(`Waiting for selector: ${selector}`);
    await page.waitForSelector(selector, { timeout });
    console.log(`Clicking on selector: ${selector}`);
    await page.click(selector);
    console.log(`Successfully clicked on ${selector}`);
  } catch (error) {
    console.error(`Error clicking ${selector}: ${error.message}`);
    throw error;
  }
}

export async function waitAndSelectOption(
  page,
  labelSelector,
  optionSelector,
  timeout = 30000
) {
  try {
    console.log(`Waiting and selecting option for label: ${labelSelector}`);
    await waitAndClick(page, labelSelector, timeout);
    console.log(`Selecting option: ${optionSelector}`);
    await waitAndClick(page, optionSelector, timeout);
    console.log(`Option selected: ${optionSelector}`);
    await delay(2500); // Wait for any dynamic content to load
  } catch (error) {
    console.error(`Error selecting option ${optionSelector}: ${error.message}`);
    throw error;
  }
}

export async function launchBrowser() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: false,
  });
  console.log("Browser launched successfully.");
  return browser;
}

export async function login(page) {
  try {
    console.log("Navigating to the France Visas online application page...");
    await page.goto("https://france-visas.gouv.fr/en/online-application", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    console.log("Clicking on the link to proceed...");
    await waitAndClick(page, "#fragment-ybkk-link");

    console.log("Waiting for the new tab to open...");
    const newPagePromise = new Promise((resolve) =>
      page.browser().once("targetcreated", async (target) => {
        const newPage = await target.page();
        if (newPage) {
          console.log("New tab detected and opened.");
          resolve(newPage);
        }
      })
    );

    const newPage = await newPagePromise;

    console.log("Waiting for login form elements...");
    await newPage.waitForSelector("#username", { timeout: 30000 });
    await newPage.waitForSelector("#password", { timeout: 30000 });

    console.log("Filling in login details...");
    await newPage.type("#username", "agent1.charradiservices@gmail.com", {
      delay: 30,
    });
    await newPage.type("#password", "Qwerty@123456", { delay: 30 });

    console.log("Submitting the login form...");
    await waitAndClick(newPage, "#kc-form-login > div.button-holder > input");

    await delay(2000);
    newPage.screenshot({ path: "./screenshots/login.png" });
    return newPage;
  } catch (error) {
    console.error(`Error during login: ${error.message}`);
    throw error;
  }
}

export async function fillForm(newPage) {
  try {
    

    await waitAndSelectOption(
      newPage,
      "#formStep1\\:visas-selected-nationality_label",
      "#formStep1\\:visas-selected-nationality_114"
    );

    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-deposit-country_label",
      "#formStep1\\:Visas-selected-deposit-country_116"
    );

    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-deposit-town_label",
      'li[data-label="Agadir"]'
    );

    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-stayDuration_label",
      'li[data-label="Court séjour (≤ 90 jours)"]'
    );

    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-destination_label",
      'li[data-label="France métropolitaine"]'
    );

    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-dde-travel-document_label",
      'li[data-label="Passeport ordinaire"]'
    );

    console.log("Filling in the travel document number...");
    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-travel-document-number",
      { timeout: 30000 }
    );
    await newPage.type(
      "#formStep1\\:Visas-dde-travel-document-number",
      "HH3645065"
    );

    console.log("Filling in the release date...");
    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-release_date_real_input",
      { timeout: 30000 }
    );
    await newPage.evaluate(() => {
      document.querySelector(
        "#formStep1\\:Visas-dde-release_date_real_input"
      ).value = "01-01-2021";
    });
    await delay(1500);

    console.log("Filling in the expiration date...");
    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-expiration_date_input",
      { timeout: 30000 }
    );
    await newPage.evaluate(() => {
      document.querySelector(
        "#formStep1\\:Visas-dde-expiration_date_input"
      ).value = "01-01-2026";
    });
    await delay(1500);

    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-purposeCategory_label",
      'li[data-label="Tourisme"]'
    );

    console.log("Verifying the form and submitting...");
    await waitAndClick(newPage, "#formStep1\\:btnVerifier");
    await delay(1500);

    await waitAndClick(newPage, "#formStep1\\:btnSuivant");
    await delay(1500);

    await waitAndClick(newPage, "#formStep1\\:btnValiderModal");
    await delay(1500);

    console.log(
      `Form submitted successfully. Current URL: ${await newPage.url()}`
    );
  } catch (error) {
    console.error(`Error during form filling: ${error.message}`);
    throw error;
  }
}

export async function processFilteredElements(newPage) {
  try {
    console.log("Processing filtered elements based on criteria...");

    if (
      (await newPage.url()) ===
      "https://application-form.france-visas.gouv.fr/fv-fo-dde/step2.xhtml"
    ) {
      console.log("Navigating to the document upload section...");
      await waitAndClick(newPage, "#dockbarDde-form\\:subMenu");
      await waitAndClick(newPage, "#dockbarDde-form\\:j_idt26");
      await delay(2500);
    }

    const filteredElements = await newPage.evaluate(() => {
      const tdElements = document.querySelectorAll(
        "td.cell.value.showIfTabletteOrDesktop.forceWidth15"
      );
      const filtered = Array.from(tdElements).filter((td) =>
        td.textContent.trim().startsWith("FRA")
      );
      return filtered.map((td) => td.textContent.trim());
    });

    console.log("Filtered elements found:", filteredElements);

    const mostRecent = filteredElements
      .map((item) => {
        const match = item.match(/(\d+)$/);
        return match ? { item, number: parseInt(match[1], 10) } : null;
      })
      .filter((x) => x)
      .sort((a, b) => b.number - a.number)
      .map((x) => x.item)[0];

    console.log("Most Recent Item:", mostRecent);
  } catch (error) {
    console.error(`Error processing filtered elements: ${error.message}`);
    throw error;
  }
}
