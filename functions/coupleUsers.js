const userDisplayNames = {
  xLUPD71OGYfG4NByDz0buh8ZIsy2: "Shosho",
  orPQHip5ooOtfSSkyLYhl5hx9Kg1: "Yuyu"
};

function getUserDisplayName(uid) {
  return userDisplayNames[uid] || "Someone";
}

module.exports = {
  getUserDisplayName
};
