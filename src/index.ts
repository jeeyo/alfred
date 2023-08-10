import { DockerClientOptions } from './dockerclient';
import Yarn from './managers/yarn';
import cli from './cli';

(async () => {
  const opts = cli.parse().options;

  const options: DockerClientOptions = {
    socketPath: opts.socket ?? '/var/run/docker.sock',
  };

  const yarn = new Yarn('/Users/jeeyo/Documents/GitHub/alfred', options);
  const dependencies = await yarn.getDependencies();
  const transitiveDependencies = await yarn.getTransitiveDependencies();

  console.log(dependencies);
  console.log(transitiveDependencies);

  // try {
  //   fastify.listen({
  //     port: 3000,
  //   });
  // } catch (err) {
  //   fastify.log.error(err);
  //   process.exit(1);
  // }
})();
