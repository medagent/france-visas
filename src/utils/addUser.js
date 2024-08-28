const { connectToDatabase, userSchema } = require("../db");
const mongoose = require("mongoose");
var Fakerator = require("fakerator");
var fakerator = Fakerator("fr-FR");

// Create a model for the user data
const User = mongoose.model("User", userSchema);

const generateIndividualUser = (i) => {
  const baseEmail = "visa_france_";
  const domain = "@cs-mail.site";
  const password = "Password@123";
  const reference_code = "";

  const email = `${baseEmail}CVCX${i.toString().padStart(2, "0")}${domain}`;
  return {
    last_name: fakerator.names.lastName(),
    first_name: fakerator.names.firstName(),
    email: email,
    password: password,
    reference_code: reference_code,
    city: "AGADIR",
    passport: `DF1020${i.toString()}`,
    passport_issue_date: "01/01/2020",
    passport_expiry_date: "01/01/2025",
    motif_voyage: "Court séjour (<90 jours) - Tourisme",
    acc_type: "indi",
    fr_visa_acc_created: false,
    members: [],
  };
};

const generateFamilyUser = (i) => {
  const baseEmail = "visa_france_";
  const domain = "@cs-mail.site";
  const password = "Password@123";
  const reference_code = "";

  const email = `${baseEmail}CVCX${i.toString().padStart(2, "0")}${domain}`;
  const members = [];

  for (let j = 16; j <= 18; j++) {
    members.push({
      member_number: `${j}E MEMBER`,
      first_name: fakerator.names.firstName(),
      last_name: fakerator.names.lastName(),
      birth_date: new Date("1990-01-01"),
      passport: `DF1020${i.toString()}${j}`,
      passport_issue_date: "01/01/2020",
      passport_expiry_date: "01/01/2025",
      phone: "",
      otp: "212770330704",
      reference_code: "",
      travel_date: new Date("2024-10-26"),
      visa_type: "short_stay",
      travel_purpose: "tourism_private_visit_primo",
      center: "maOUD2fr",
      city: "OUJDA",
      cas: "1",
      category: "tourism",
      passport_blocked: false,
    });
  }

  return {
    last_name: fakerator.names.lastName(),
    first_name: fakerator.names.firstName(),
    email: email,
    password: password,
    reference_code: reference_code,
    city: "OUJDA",
    passport: `DF1020${i.toString()}`,
    passport_issue_date: "01/01/2020",
    passport_expiry_date: "01/01/2025",
    motif_voyage: "Court séjour (<90 jours) - Tourisme",
    acc_type: "family",
    fr_visa_acc_created: false,
    members: members,
  };
};

const generateUserData = () => {
  const users = [];
  for (let i = 1026; i < 1036; i++) {
    const userType =
      i % 2 === 0 ? generateIndividualUser(i) : generateFamilyUser(i);
    users.push(userType);
  }
  return users;
};

// Function to insert generated user data into the database
const insertUsersIntoDb = async () => {
  try {
    await connectToDatabase();
    const userDataList = generateUserData();
    await User.insertMany(userDataList);
    console.log("User data successfully inserted into the database.");
  } catch (error) {
    console.error("Error inserting user data:", error);
  } finally {
    mongoose.connection.close();
  }
};

// Call the function to insert data
insertUsersIntoDb();

module.exports = { userSchema };
