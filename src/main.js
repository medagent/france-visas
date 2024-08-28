const { delay } = require("./extra.js");
const { createAccount } = require("./createAccount.js");
const { getReferance, getReferanceForMember } = require("./getReferance.js");
const { connectToDatabase, getUsersData, userSchema } = require("./db.js");
const mongoose = require("mongoose");
const clc = require("cli-color");
const fs = require("fs");

const path = "./logs/form_errors.txt";
const resultLogPath = "./logs/result.txt";

(async () => {

  try {
    // Clear the file contents at the start of the script
    fs.writeFileSync(path, "", "utf-8");

    // Connect to MongoDB
    await connectToDatabase();
    const User = mongoose.model("User", userSchema);

    // Fetch the list of users
    const usersData = await getUsersData();

    if (!usersData || usersData.length === 0) {
      throw new Error("No user data found");
    }

    for (const userData of usersData) {
      try {
        if (userData.reference_code && userData.acc_type === "indi") {
          console.log(clc.green(`Reference found for ${userData.email}`));
          continue;
        }

        //ACCOUNT F.V. CREATED

        if (userData.client_status === "ACCOUNT NOT YET CREATED") {
          // Separate each user log in the result file
          fs.appendFileSync(
            resultLogPath,
            "--------------------------------------------------------------------------\n\n",
            "utf-8"
          );
          console.log(
            clc.yellow("=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=")
          );
          console.log(clc.yellow(`Creating account for ${userData.email}...`));
          console.log(clc.blue(`Account Type: ${userData.acc_type}...`));
          console.log(
            clc.yellow("=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=")
          );

          // Create account
          await createAccount(userData);

          fs.appendFileSync(
            resultLogPath,
            `${userData.email} - account created successfully\n`,
            "utf-8"
          );
          // Wait for 6 seconds
          await delay(6000);
        }

        if (!userData.reference_code) {
          // Handle reference creation for the main user
          console.log(
            clc.yellow("=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=")
          );
          console.log(
            clc.yellow(`Creating reference for ${userData.email}...`)
          );
          console.log(
            clc.yellow("=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=")
          );

          const mostRecent = await getReferance(userData);

          console.log(`Reference for ${userData.email}:`, mostRecent);

          if (!mostRecent) {
            console.error(`No reference found for ${userData.email}`);
            continue;
          }

          fs.appendFileSync(
            resultLogPath,
            `     - ${userData.first_name} ${userData.last_name} - ${userData.passport} - reference generated: ${mostRecent}\n`,
            "utf-8"
          );

          // Update the main user's reference code in the database
          const updatedUser = await User.findOneAndUpdate(
            { email: userData.email },
            { reference_code: mostRecent },
            { new: true }
          );

          if (!updatedUser) {
            console.error(`Failed to update user ${userData.email}`);
            continue;
          }
        }

        // If the account type is "family", handle references for all family members
        if (userData.acc_type === "family") {
          for (const member of userData.members) {
            if (!member.reference_code) {
              console.log(
                clc.yellow("=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=")
              );
              console.log(
                clc.yellow(
                  `Creating references for family members of ${member.first_name} ${member.last_name}...`
                )
              );
              console.log(
                clc.yellow("=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=")
              );
              const memberReference = await getReferanceForMember(
                userData,
                member
              );
              console.log(
                `Reference for ${member.first_name} ${member.last_name}:`,
                memberReference
              );

              if (memberReference) {
                fs.appendFileSync(
                  resultLogPath,
                  `     - ${member.first_name} ${member.last_name} - ${member.passport} - reference generated: ${memberReference}\n`,
                  "utf-8"
                );

                // Update the family member's reference code in the database
                await User.updateOne(
                  { "members.passport": member.passport },
                  { $set: { "members.$.reference_code": memberReference } }
                );
              } else {
                console.error(
                  `No reference found for ${member.first_name} ${member.last_name}`
                );
              }
            }
          }
        }

        console.log(clc.green(`Finished processing ${userData.email}`));
        console.log("====================================================");
      } catch (error) {
        console.error(`Error processing ${userData.email}: ${error.message}`);
        continue;
      }
    }
  } catch (error) {
    console.error(`Error during execution: ${error.message}`);
  } finally {
    mongoose.connection.close();
  }
})();
