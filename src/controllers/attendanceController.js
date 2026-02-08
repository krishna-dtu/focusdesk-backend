const ScanLog = require("../models/ScanLog");
const AccessRequest = require("../models/AccessRequest");

const getAttendance = async (req, res) => {
  try {
    console.log("📊 Fetching attendance logs...");
    
    const logs = await ScanLog.findAll({
      order: [["createdAt", "ASC"]],
    });

    console.log(`✅ Found ${logs.length} scan logs`);

    if (!logs.length) {
      console.log("⚠️ No scan logs found, returning empty array");
      return res.json([]);
    }

    const attendanceMap = {};

    logs.forEach((log) => {
      if (!attendanceMap[log.requestId]) {
        attendanceMap[log.requestId] = {
          requestId: log.requestId,
          firstIn: null,
          lastOut: null,
          breaks: 0,
        };
      }

      if (log.passType === "IN") {
        if (!attendanceMap[log.requestId].firstIn) {
          attendanceMap[log.requestId].firstIn = log.createdAt;
        }
      }

      if (log.passType === "OUT") {
        attendanceMap[log.requestId].lastOut = log.createdAt;
        attendanceMap[log.requestId].breaks += 1;
      }
    });

    // ✅ Fetch User Details from AccessRequest table
    const requestIds = Object.keys(attendanceMap).map(id => parseInt(id));
    console.log(`📋 Fetching user details for request IDs:`, requestIds);

    const users = await AccessRequest.findAll({
      where: { id: requestIds },
    });

    console.log(`✅ Found ${users.length} users`);
    
    // Debug: Log table name being used
    console.log(`📊 Table name: ${AccessRequest.tableName}`);
    
    // Debug: Try to get all users to see if table has data
    const allUsers = await AccessRequest.findAll({ limit: 5 });
    console.log(`📊 Total users in table (first 5):`, allUsers.length);
    if (allUsers.length > 0) {
      console.log(`📊 Sample user IDs:`, allUsers.map(u => u.id));
    }

    // ✅ Merge user info into attendance
    const finalData = users.map((user) => {
      return {
        requestId: user.id,
        fullName: user.fullName,
        idNumber: user.idNumber,
        organisation: user.organisation,

        firstIn: attendanceMap[user.id].firstIn,
        lastOut: attendanceMap[user.id].lastOut,
        breaks: attendanceMap[user.id].breaks,
      };
    });

    console.log(`✅ Returning ${finalData.length} attendance records`);

    return res.json(finalData);
  } catch (err) {
    console.error("❌ Attendance Error:", err);

    return res.status(500).json({
      message: "Attendance fetch failed",
      error: err.message,
    });
  }
};

module.exports = { getAttendance };
