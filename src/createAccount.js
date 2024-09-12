const fs = require("fs");
const path = require("path");
const readline = require("readline");
const qs = require("qs");
const axios = require("axios");
const clc = require("cli-color");
const mongoose = require("mongoose");
const { userSchema } = require("./db.js");
require("dotenv").config({ path: "../.env" });

function delay(time) {
  // console.log(`Delaying for ${time}ms...`);
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const refresh_token = process.env.REFRESH_TOKEN;

// Google Console API key
const apiKey = process.env.API_KEY;

const User = mongoose.model("User", userSchema);

const createAccount = async (userData) => {
  var { connect } = await import("puppeteer-real-browser");

  const { page, browser, setTarget } = await connect({
    headless: "auto",
    fingerprint: false,
    turnstile: true,
  });

  try {
    console.log("Navigating to the France Visas online application page...");
    await page.goto("https://france-visas.gouv.fr/en/online-application", {
      waitUntil: "domcontentloaded",
    });

    console.log("Getting the link's URL...");
    // Extract the URL from the link element
    await page.waitForSelector("#fragment-ybkk-link", { timeout: 0 });
    const linkHref = await page.$eval(
      "#fragment-ybkk-link",
      (element) => element.href
    );
    console.log(`Link URL: ${linkHref}`);

    setTarget({ status: false });

    let page2 = await browser.newPage();

    setTarget({ status: true });

    await page2.goto(linkHref);

    // setInterval(() => { page2.screenshot({ path: 'example.png' }).catch(err => { }); }, 500);

    console.log("Waiting for Create Account Button...");
    await page2.waitForSelector(
      "#div-create-account .button-holder a.btn.primaire",
      { timeout: 0 }
    );

    console.log("Clicking on Create Account Button...");
    await page2.click("#div-create-account .button-holder a.btn.primaire");

    await solveCaptcha(apiKey, userData, page2);

    await User.findOneAndUpdate(
      { email: userData.email },
      { client_status: "ACCOUNT F.V. CREATED" },
      { new: true }
    );
  } catch (error) {
    throw error;
  } finally {
    await browser.close();
  }
};

async function solveCaptcha(apiKey, userData, page) {
  // Dynamically import
  const { default: terminalImage } = await import("terminal-image");

  try {
    let captchaText = "";
    let confidence = 0;
    let attempts = 0;
    const maxAttempts = 6;

    while (attempts < maxAttempts) {
      attempts += 1;
      console.log(`Attempt ${attempts} of ${maxAttempts}`);
      await delay(6000);
      
      const captchaElement = await page.waitForSelector(
        "#alphanumerique4to6LightCaptchaFR_CaptchaImage",
        { timeout: 20000 }
      );

      console.log("Extracting the image...");
      const imagePath = path.join(__dirname, "./screenshots/captcha_image.png");
      await captchaElement.screenshot({ path: imagePath });
      const imageBuffer = fs.readFileSync(imagePath);

      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                image: {
                  content: imageBuffer.toString("base64"),
                },
                features: [
                  {
                    type: "DOCUMENT_TEXT_DETECTION",
                  },
                ],
              },
            ],
          }),
        }
      );

      const visionResult = await visionResponse.json();
      const fullTextAnnotation = visionResult.responses[0]?.fullTextAnnotation;

      if (fullTextAnnotation) {
        const firstWord =
          fullTextAnnotation.pages[0].blocks[0].paragraphs[0].words[0];
        captchaText = firstWord.symbols.map((symbol) => symbol.text).join("");
        confidence = firstWord.confidence || 0;

        console.log(`Word: ${captchaText}, Confidence: ${confidence}`);
      }

      if (confidence >= 0.85) {
        console.log(`Confidence is sufficient: ${confidence}`);
        console.log(await terminalImage.file(imagePath, { width: 70 }));

        const answer = await new Promise((resolve) => {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          rl.question("Is the answer correct? (Y/n) [Y]: ", (input) => {
            rl.close();
            resolve(input.toUpperCase() || "Y"); // Defaults to "Y" if input is empty
          });
        });

        if (answer === "Y") {
          console.log(`Correct answer: ${captchaText}`);
          console.log("Submitting the form...");
          await fillAndSubmitForm(captchaText, userData, page);
          return; // Exit the function after successful submission
        } else {
          console.log("Reloading CAPTCHA...");
          await page.reload({ waitUntil: "networkidle0" });
          continue;
        }
      } else {
        console.log("Confidence is too low, reloading CAPTCHA...");
        await page.reload({ waitUntil: "networkidle0" });
      }
    }

    // If the max attempts are exceeded
    while (true) {
      console.log(clc.red("Max attempts exceeded. Please solve the CAPTCHA manually."));

      // Ensure a new CAPTCHA image is captured each time
      const captchaElement = await page.waitForSelector(
        "#alphanumerique4to6LightCaptchaFR_CaptchaImage",
        { timeout: 20000 }
      );
      const imagePath = path.join(__dirname, "./screenshots/captcha_image.png");
      await captchaElement.screenshot({ path: imagePath });

      console.log(await terminalImage.file(imagePath, { width: 70 }));
      
      const manualInput = await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question(
          "Please enter the CAPTCHA text or type 'R' to reload: ",
          (input) => {
            rl.close();
            resolve(input.toUpperCase());
          }
        );
      });

      if (manualInput === "R") {
        console.log("Reloading CAPTCHA...");
        await page.reload({ waitUntil: "networkidle0" });
        attempts = 0; // Reset attempts
        confidence = 0; // Reset confidence
        continue; // Retry the captcha process
      } else {
        console.log(`Manual input received: ${manualInput}`);
        console.log(clc.green("Submitting the form..."));
        await fillAndSubmitForm(manualInput, userData, page);
        break; // Exit the loop after successful submission
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
    if (error.name !== "TimeoutError") {
      await page.reload({ waitUntil: "networkidle0" });
      await solveCaptcha(apiKey, userData, page);
    } else {
      throw error;
    }
  }
}


async function fillAndSubmitForm(captchaText, userData, page) {
  await page.waitForSelector("#subButton", { timeout: 0 });
  await page.evaluate(
    (captchaText, userData) => {
      const data = {
        lastName: userData.last_name,
        firstName: userData.first_name,
        email: userData.email,
        emailVerif: userData.email,
        password: userData.password,
      };

      document.getElementById("lastName").value = data.lastName;
      document.getElementById("firstName").value = data.firstName;
      document.getElementById("email").value = data.email;
      document.getElementById("emailVerif").value = data.emailVerif;
      document.getElementById("password").value = data.password;
      document.getElementById("password-confirm").value = data.password;
      document.getElementById("captchaFormulaireExtInput").value = captchaText;
      document.getElementById("subButton").click();
    },
    captchaText,
    userData
  );

  console.log(clc.green("Submitted the form..."));
  const submitTime = Date.now();

  await page.screenshot({
    path: "./screenshots/submitted.png",
    fullPage: true,
  });

  console.log("Waiting for verification email...");
  await delay(3000);

  try {
    await page.waitForSelector(
      "#cors > div:nth-child(2) > div > div > fieldset > div > div > div:nth-child(4) > div > a",
      { timeout: 10000 }
    );

    const verificationLink = await getVerificationLink(submitTime);
    if (!verificationLink) {
      console.log(clc.yellowBright("Verification link not found."));
      return;
    }
    console.log(clc.green(`Verification link: ${verificationLink}`));
    await verifyAccount(verificationLink);
  } catch (timeoutError) {
    console.log("Timeout waiting for verification link.");

    // Check for multiple error messages
    const errorMessages = await page.evaluate(() => {
      const errorElements = document.querySelectorAll(".alert-error");
      return Array.from(errorElements).map((el) => el.textContent.trim());
    });

    if (errorMessages.length > 0) {
      console.error("Form submission errors:", errorMessages);

      // Save the error messages to a text file
      let errorLog = errorMessages.join("\n");
      errorLog += `\nfor user : ${userData.email}\n`;
      errorLog += "---------------------------------------------------------\n";

      fs.appendFileSync("./logs/form_errors.txt", errorLog, "utf-8", (err) => {
        if (err) {
          console.error("Error saving error messages:", err);
        }
      });
      console.log("Error messages saved to error_logs/form_errors.txt");
    } else {
      console.log("No specific error messages found.");
    }

    throw timeoutError;
  }
}

async function getVerificationLink(submitTime) {
  console.log("Refreshing access token...");
  let accessToken = await refreshAccessToken();
  return await checkForEmailWithVerificationLink(accessToken, submitTime);
}

async function refreshAccessToken() {
  const url = "https://oauth2.googleapis.com/token";
  const data = {
    client_id,
    client_secret,
    refresh_token,
    grant_type: "refresh_token",
  };

  const response = await axios.post(url, qs.stringify(data));
  if (response.status === 200) {
    const tokenData = response.data;
    console.log("Access token refreshed successfully!");
    console.log(tokenData);
    return tokenData.access_token;
  } else {
    throw new Error(`Error refreshing access token: ${response.status}`);
  }
}

async function checkForEmailWithVerificationLink(
  accessToken,
  submitTime,
  maxRetries = 6,
  retryCount = 0
) {
  // Convert the submitTime to Unix timestamp (in seconds)
  const unixTime = Math.floor(submitTime / 1000);

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=subject:"Creation de votre compte France-Visas / Create your France-Visas account" after:${unixTime}&maxResults=1`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  let emailFound = false;

  while (!emailFound) {
    retryCount++;
    if (retryCount >= maxRetries) {
      break;
    }
    const response = await axios.get(url, { headers });
    if (
      response.status === 200 &&
      response.data.messages &&
      response.data.messages.length > 0
    ) {
      emailFound = true;
      // clearTimeout(retryLoop); // Stop the retry button loop
      const messageId = response.data.messages[0].id;
      return getEmailMessage(accessToken, messageId);
    } else {
      console.log(clc.red("No emails found. Checking again in 8 seconds..."));
      await delay(8000);
    }
  }
}

async function getEmailMessage(accessToken, messageId) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await axios.get(url, { headers });
  if (response.status === 200) {
    const body = response.data.payload.parts.find(
      (part) => part.mimeType === "text/html"
    ).body.data;
    const decodedBody = Buffer.from(body, "base64").toString("utf8");
    const verificationLink = decodedBody.match(
      /https:\/\/connect\.france-visas\.gouv\.fr\/[^\s]+/
    )[0];
    return verificationLink;
  } else {
    throw new Error(`Error retrieving email message: ${response.status}`);
  }
}

async function verifyAccount(verificationLink) {
  var { connect } = await import("puppeteer-real-browser");
  const { page, browser, setTarget } = await connect({
    headless: "auto",
    fingerprint: false,
    turnstile: true,
  });
  try {
    console.log("---------------------------------------------------------");
    console.log("Navigating to the verification email...");
    await page.goto(verificationLink, { waitUntil: "networkidle0" });
    await delay(2500);
    const selector = 'a.btn.primaire[role="button"]';
    const content = "»"; // The content you want to check for

    await waitForSelectorAndContent(page, selector, content);

    console.log("---------------------------------------------------------");
    console.log("Verification completed successfully!");
    console.log("---------------------------------------------------------");
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await browser.close();
  }
}

async function waitForSelectorAndContent(
  page,
  selector,
  content,
  timeout = 10000
) {
  try {
    await page.waitForFunction(
      (selector, content) => {
        const element = document.querySelector(selector);
        return element && element.textContent.includes(content);
      },
      { timeout },
      selector,
      content
    );

    console.log(
      "Element with the specified content found. Clicking the button..."
    );
    await page.click(selector);
  } catch (error) {
    console.error(
      `Element not found within ${timeout / 1000} seconds. Retrying...`
    );
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
    await waitForSelectorAndContent(page, selector, content, timeout);
  }
}

module.exports = { createAccount, getVerificationLink, verifyAccount };
