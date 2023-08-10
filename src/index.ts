import { DockerClientOptions } from './dockerclient';
import Yarn from './managers/yarn';
import cli from './cli';

(async () => {
  const opts = cli.parse().options;

  const options: DockerClientOptions = {
    socketPath: opts.socket ?? '/var/run/docker.sock',
  };

  const yarn = new Yarn('/Users/jeeyo/Documents/GitHub/alfred', options);
  await yarn.getTransitiveDependencies();
})();
