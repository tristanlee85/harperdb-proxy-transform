import { getPort } from 'get-port-please';

!(async () => {
	const port = await getPort({ portRange: [3000, 3005] });
	console.log(port);
})();
