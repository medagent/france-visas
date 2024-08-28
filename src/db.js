const mongoose = require('mongoose');

let isConnected;

const connectToDatabase = async () => {
  if (isConnected) {
    console.log('Using existing database connection');
    return mongoose.connection;
  }

  console.log('Establishing new database connection...');
  try {
    await mongoose.connect('mongodb://localhost:27017/local', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = mongoose.connection.readyState;
    console.log('Database connection established');
    return mongoose.connection;
  } catch (error) {
    console.error('Error connecting to the database:', error);
    throw error;
  }
};

const memberSchema = new mongoose.Schema({
  sous_categorie:  String,
  appointment_sub_category:  String,
  member_number:  String,
  first_name:  String,
  last_name:  String,
  birth_date:  Date,
  passport:  String,
  passport_issue_date:  String,
  passport_expiry_date:  String,
  phone:  String ,
  otp:  String,
  reference_code:  String ,
  travel_date:  Date,
  visa_type:  String,
  travel_purpose:  String,
  center:  String,
  city:  String,
  cas:  String,
  category:  String,
  passport_blocked:  Boolean
});

// Define a schema for user data
const userSchema = new mongoose.Schema({
  last_name: String,
  first_name: String,
  email: String,
  password: String,
  reference_code: String,
  // nationality: String, // static
  // deposit_country: String, // static
  // travel_document: String, // static
  // destination: String, // static
  city: String, // deposit-town
  passport: String, // travel-document-number  
  passport_issue_date: String, // not yet found
  passport_expiry_date: String, // not yet found
  motif_voyage: String, // to be checked

  acc_type: String,
  fr_visa_acc_created: Boolean,
  client_status: String,
  members: [memberSchema]
});

// Create a model for the user data
const User = mongoose.model("User", userSchema);

async function getUsersData() {
  try {
    // Fetch multiple user data from the MongoDB database
    const usersData = await User.find({});
    return usersData;
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
}

module.exports = {connectToDatabase, getUsersData, userSchema};
