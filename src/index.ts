import DockerClient from './dockerclient';
import cli from './cli';

(async () => {
  const opts = cli.parse().options;
  const socketPath = opts.socket ?? '/var/run/docker.sock';

  const dockerClient = new DockerClient('hello-world:latest', [], ['/hello'], socketPath);
})();
