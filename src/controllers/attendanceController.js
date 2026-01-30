const ScanLog = require("../models/ScanLog");
const AccessRequest = require("../models/AccessRequest");

const getAttendance = async (req, res) => {
  try {
    const logs = await ScanLog.findAll({
      order: [["createdAt", "ASC"]],
    });

    if (!logs.length) {
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
    const requestIds = Object.keys(attendanceMap);

    const users = await AccessRequest.findAll({
      where: { id: requestIds },
    });

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

    return res.json(finalData);
  } catch (err) {
    console.error("Attendance Error:", err);

    return res.status(500).json({
      message: "Attendance fetch failed",
      error: err.message,
    });
  }
};

module.exports = { getAttendance };
