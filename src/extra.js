const clc = require("cli-color");
const { getVerificationLink, verifyAccount } = require("./createAccount.js");

function delay(time) {
  // console.log(`Delaying for ${time}ms...`);
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

async function launchRealBrowser() {
  var { connect } = await import("puppeteer-real-browser");
  const { page, browser } = await connect({});

  await page.setRequestInterception(true); // enable request interception

  // intercept requests that are not for document, xhr, fetch, or script
  page.on("request", (req) => {
    if (["image", "media"].includes(req.resourceType())) {
      return req.abort();
    }
    req.continue();
  });

  return { page, browser };
}

async function login(page, userData) {
  try {
    await page.goto("https://application-form.france-visas.gouv.fr/fv-fo-dde/");

    console.log("Waiting for login form elements...");
    await page.waitForSelector("#username", { timeout: 10000, visible: true });
    await page.waitForSelector("#password", { timeout: 10000, visible: true });

    console.log("Filling in login details...");
    await page.type("#username", userData.email, { delay: 30 });
    await page.type("#password", userData.password, { delay: 30 });

    console.log("Submitting the login form...");
    await waitAndClick(page, "#kc-form-login > div.button-holder > input");

    await delay(2000);
    // page.screenshot({ path: "./screenshots/login.png", fullPage: true });

    // Check if the account needs to be verified
    const verificationNeeded = await page.evaluate(() => {
      const feedbackElement = document.querySelector("span.kc-feedback-text");
      return (
        feedbackElement &&
        feedbackElement.textContent.includes(
          "You must verify your email address to activate your account."
        )
      );
    });

    if (verificationNeeded) {
      console.log(
        clc.red("Account not activated. Resending verification email...")
      );

      // Click the "Resend an email" button
      await waitAndClick(page, 'a.btn.primaire[role="button"]');
      const submitTime = Date.now();

      console.log("Retrieving verification link...");
      const verificationLink = await getVerificationLink(submitTime, page);

      console.log("Verifying account...");
      await verifyAccount(verificationLink);

      console.log(clc.green("Account verified. Please try logging in again."));
      await page.goto(
        "https://application-form.france-visas.gouv.fr/fv-fo-dde/"
      );
      return await login(page, userData); // Retry login after verification
    }

    // page.screenshot({ path: "./screenshots/login.png", fullPage: true });
    console.log("-----------------------------------------------");
    console.log("Logged in successfully.");
    console.log("-----------------------------------------------");

    await delay(2000);
    console.log("Starting to fill out the visa application form...");
    await waitAndClick(page, "#formAccueilUsager\\:ajouterGroupe");

    console.log("-----------------------------------------------");
    console.log("Clicked on 'Add Group' button.");
    console.log("-----------------------------------------------");

    return page;
  } catch (error) {
    console.error(`Error during login: ${error.message}`);
    await page.goto("https://application-form.france-visas.gouv.fr/fv-fo-dde/");
    return await login(page, userData);
  }
}

async function loginMember(page, userData) {
  try {
    await page.goto("https://application-form.france-visas.gouv.fr/fv-fo-dde/");

    console.log("Waiting for login form elements...");
    await page.waitForSelector("#username", { timeout: 0, visible: true });
    await page.waitForSelector("#password", { timeout: 0, visible: true });

    console.log("Filling in login details...");
    await page.type("#username", userData.email, {
      delay: 30,
    });
    await page.type("#password", userData.password, { delay: 30 });

    console.log("Submitting the login form...");
    await waitAndClick(page, "#kc-form-login > div.button-holder > input");

    // page.screenshot({ path: "./screenshots/login.png", fullPage: true });
    console.log("-----------------------------------------------");
    console.log("Logged in successfully.");
    console.log("-----------------------------------------------");

    await delay(2000);
    console.log("Starting to fill out the visa application form...");
    await waitAndClick(
      page,
      "#formAccueilUsager\\:j_idt72\\:0\\:ajouterDemande"
    );

    console.log("-----------------------------------------------");
    console.log("Clicked on 'Add Demand' button.");
    console.log("-----------------------------------------------");

    return page;
  } catch (error) {
    console.error(`Error during login: ${error.message}`);
    await page.goto("https://application-form.france-visas.gouv.fr/fv-fo-dde/");
    await login(page, userData);
  }
}

async function fillForm(newPage, userData) {
  // setInterval(async () => {
  //   await newPage.screenshot({ path: `screenshots/test.png` });
  // });

  const nationality = "Marocaine";
  const deposit_country = "Maroc";
  const destination = "France métropolitaine";
  const travel_document = "Passeport ordinaire";

  const transformedCity =
    userData.city.charAt(0).toUpperCase() +
    userData.city.slice(1).toLowerCase();
  userData.city = transformedCity;

  let [motif_voyage1, motif_voyage2] = userData.motif_voyage.split(" - ");
  // const visa_type = "short_stay";
  // let motif_voyage = "";

  if (motif_voyage1 === "Court séjour (<90 jours)") {
    motif_voyage1 = "Court séjour (≤ 90 jours)";
  } else {
    motif_voyage1 = "Long séjour (> 90 jours)";
  }

  try {
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:visas-selected-nationality_label",
      `li[data-label="${nationality}"]`
    );

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-deposit-country_label",
      `li[data-label="${deposit_country}"]`
    );

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-deposit-town_label",
      `li[data-label="${userData.city}"]`
    );

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-stayDuration_label",
      `li[data-label="${motif_voyage1}"]`
    );

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-destination_label",
      `li[data-label="${destination}"]`
    );

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-dde-travel-document_label",
      `li[data-label="${travel_document}"]`
    );

    console.log("-----------------------------------------------");
    console.log("Filling in the travel document number...");
    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-travel-document-number",
      { timeout: 10000, visible: true }
    );
    await newPage.evaluate(
      (el) => (el.value = ""),
      await newPage.$("#formStep1\\:Visas-dde-travel-document-number")
    );
    await newPage.type(
      "#formStep1\\:Visas-dde-travel-document-number",
      userData.passport,
      { delay: 10 }
    );

    console.log("-----------------------------------------------");
    console.log("Filling in the release date...");

    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-release_date_real_input",
      { timeout: 10000, visible: true }
    );
    await newPage.evaluate((userData) => {
      document.querySelector(
        "#formStep1\\:Visas-dde-release_date_real_input"
      ).value = userData.passport_issue_date;
    }, userData);

    await delay(1500);
    console.log("-----------------------------------------------");
    console.log("Filling in the expiration date...");

    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-expiration_date_input",
      { timeout: 10000, visible: true }
    );
    await newPage.evaluate((userData) => {
      document.querySelector(
        "#formStep1\\:Visas-dde-expiration_date_input"
      ).value = userData.passport_expiry_date;
    }, userData);
    await delay(1500);

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-purposeCategory_label",
      `li[data-label="${motif_voyage2}"]`
    );
    await delay(1700);

    if (motif_voyage2 === "Visite familiale ou privée") {
      console.log("-----------------------------------------------");

      await waitAndSelectOption(
        newPage,
        "#formStep1\\:Visas-selected-purpose_label",
        `li[data-label="Visite familiale"]`
      );
    }

    console.log("-----------------------------------------------");
    console.log("Verifying the form and submitting...");
    console.log("-----------------------------------------------");

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
    await newPage.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
    await fillForm(newPage, userData);
  }
}

async function fillMemberForm(newPage, userData, memberData) {
  const nationality = "Marocaine";
  const destination = "France métropolitaine";
  const travel_document = "Passeport ordinaire";

  const transformedCity =
    userData.city.charAt(0).toUpperCase() +
    userData.city.slice(1).toLowerCase();
  userData.city = transformedCity;

  let [motif_voyage1, motif_voyage2] = userData.motif_voyage.split(" - ");
  // const visa_type = "short_stay";
  // let motif_voyage = "";

  if (motif_voyage1 === "Court séjour (<90 jours)") {
    motif_voyage1 = "Court séjour (≤ 90 jours)";
  } else {
    motif_voyage1 = "Long séjour (> 90 jours)";
  }

  try {
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:visas-selected-nationality_label",
      `li[data-label="${nationality}"]`
    );

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-stayDuration_label",
      `li[data-label="${motif_voyage1}"]`
    );

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-destination_label",
      `li[data-label="${destination}"]`
    );

    await delay(2000);

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-dde-travel-document_label",
      `li[data-label="${travel_document}"]`
    );

    console.log("-----------------------------------------------");
    console.log("Filling in the travel document number...");
    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-travel-document-number",
      { timeout: 10000, visible: true }
    );
    await newPage.evaluate(
      (el) => (el.value = ""),
      await newPage.$("#formStep1\\:Visas-dde-travel-document-number")
    );

    await newPage.type(
      "#formStep1\\:Visas-dde-travel-document-number",
      memberData.passport,
      { delay: 10 }
    );

    console.log("-----------------------------------------------");
    console.log("Filling in the release date...");

    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-release_date_real_input",
      { timeout: 10000, visible: true }
    );
    await newPage.evaluate((memberData) => {
      document.querySelector(
        "#formStep1\\:Visas-dde-release_date_real_input"
      ).value = memberData.passport_issue_date;
    }, memberData);

    await delay(1500);
    console.log("-----------------------------------------------");
    console.log("Filling in the expiration date...");

    await newPage.waitForSelector(
      "#formStep1\\:Visas-dde-expiration_date_input",
      { timeout: 10000, visible: true }
    );
    await newPage.evaluate((memberData) => {
      document.querySelector(
        "#formStep1\\:Visas-dde-expiration_date_input"
      ).value = memberData.passport_expiry_date;
    }, memberData);
    await delay(1500);

    console.log("-----------------------------------------------");
    await waitAndSelectOption(
      newPage,
      "#formStep1\\:Visas-selected-purposeCategory_label",
      `li[data-label="${motif_voyage2}"]`
    );

    if (motif_voyage2 === "Visite familiale ou privée") {
      console.log("-----------------------------------------------");

      await waitAndSelectOption(
        newPage,
        "#formStep1\\:Visas-selected-purpose_label",
        `li[data-label="Visite familiale"]`
      );
    }

    console.log("-----------------------------------------------");
    console.log("Verifying the form and submitting...");
    console.log("-----------------------------------------------");

    await waitAndClick(newPage, "#formStep1\\:btnVerifier");
    await delay(3000);

    await waitAndClick(newPage, "#formStep1\\:btnSuivant");
    await delay(1500);

    await waitAndClick(newPage, "#formStep1\\:btnValiderModal");
    await delay(1500);

    console.log(
      `Form submitted successfully. Current URL: ${await newPage.url()}`
    );
  } catch (error) {
    console.error(`Error during form filling: ${error.message}`);
    await newPage.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
    await fillMemberForm(newPage, userData, memberData)
  }
}

async function processFilteredElements(
  newPage,
  retryCount = 0,
  maxRetries = 3
) {
  try {
    console.log("Processing filtered elements based on criteria...");

    if (
      (await newPage.url()) ===
      "https://application-form.france-visas.gouv.fr/fv-fo-dde/step2.xhtml"
    ) {
      console.log("Navigating to the document upload section...");
      await waitAndClick(newPage, "#dockbarDde-form\\:subMenu");
      await waitAndClick(newPage, "#dockbarDde-form\\:j_idt26");
    }

    await delay(6000);

    console.log("-----------------------------------------------");
    console.log("Fetching filtered elements...");

    await newPage.waitForSelector(
      "td.cell.value.showIfTabletteOrDesktop.forceWidth15",
      { timeout: 10000, visible: true }
    );

    const filteredElements = await newPage.evaluate(() => {
      const tdElements = document.querySelectorAll(
        "td.cell.value.showIfTabletteOrDesktop.forceWidth15"
      );

      // Filter elements that start with "FRA"
      const filtered = Array.from(tdElements)
        .filter((td) => td.textContent.trim().startsWith("FRA"))
        .map((td) => td.textContent.trim());

      return filtered;
    });

    console.log("-----------------------------------------------");
    console.log("Filtered elements found:", filteredElements);

    // The first element in the list corresponds to the most recent one
    const mostRecent = filteredElements[0];

    console.log("Most Recent Item:", mostRecent);
    console.log("-----------------------------------------------");

    return mostRecent;
  } catch (error) {
    console.error(`Error processing filtered elements: ${error.message}`);

    if (retryCount < maxRetries) {
      console.log(`Retrying... (${retryCount + 1}/${maxRetries})`);
      return await processFilteredElements(newPage, retryCount + 1, maxRetries);
    } else {
      console.error("Max retries reached. Aborting process.");
      throw error; // Re-throw the error after max retries are exceeded
    }
  }
}

async function waitAndClick(page, selector, maxRetries = 3, retryCount = 0) {
  try {
    console.log(`Waiting for selector: ${selector}`);
    await page.waitForSelector(selector, { timeout: 10000, visible: true });
    console.log(`Clicking on selector: ${selector}`);
    await page.click(selector);
    console.log(clc.green(`Successfully clicked on ${selector}`));
  } catch (error) {
    console.error(`Error selecting option ${optionSelector}: ${error.message}`);
    throw error;
  }
}

async function waitAndSelectOption(page, labelSelector, optionSelector) {
  try {
    console.log(`Waiting and selecting option for label: ${labelSelector}`);
    await waitAndClick(page, labelSelector);
    await delay(3800); // Wait for any dynamic content to load
    console.log(`Selecting option: ${optionSelector}`);
    await waitAndClick(page, optionSelector);
    console.log(`Option selected: ${optionSelector}`);
    await delay(2000); // Wait for any dynamic content to load
  } catch (error) {
    console.error(`Error selecting option ${optionSelector}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  launchRealBrowser,
  login,
  loginMember,
  fillForm,
  fillMemberForm,
  processFilteredElements,
  delay,
  waitAndClick,
  waitAndSelectOption,
};
