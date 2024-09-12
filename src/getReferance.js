const {
  login,
  loginMember,
  fillForm,
  fillMemberForm,
  processFilteredElements,
  delay,
} = require("./extra.js");

const { launchRealBrowser } = require("./extra.js");

async function getReferance(userData) {
  const { page, browser } = await launchRealBrowser();

  try {
    const homePage = await login(page, userData);
    await delay(3000);
    await fillForm(homePage, userData);
    await delay(3000);
    return await processFilteredElements(homePage);
  } catch (error) {
    console.error(`Error during execution: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function getReferanceForMember(userData, memberData) {
  const { page, browser } = await launchRealBrowser();
 
  try {
    const homePage = await loginMember(page, userData);
    await delay(3000);
    await fillMemberForm(homePage, userData, memberData);
    await delay(3000);
    return await processFilteredElements(homePage);
  } catch (error) {
    console.error(`Error during execution: ${error.message}`);
  } finally {
    await browser.close();
  }
}

module.exports = {
  getReferance,
  getReferanceForMember,
};
