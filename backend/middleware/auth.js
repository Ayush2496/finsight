// middleware/auth.js
// Reusable middleware that protects any route.
// Import and use it in any route file like:
//   router.get('/protected', isAuthenticated, (req, res) => { ... })

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next(); // user is logged in, continue to the route
  }
  return res.status(401).json({
    error: 'Unauthorized. Please log in first.'
  });
}

module.exports = isAuthenticated;
