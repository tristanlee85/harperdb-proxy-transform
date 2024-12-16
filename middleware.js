// middleware.js
export default (options) => {
	return (req, res, next) => {
		// Example logic using options
		console.log(`Middleware activated with options:`, options);

		// Call next to pass control to the next middleware
		next();
	};
};
