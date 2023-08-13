import DockerClient, { DockerClientOptions } from './dockerclient';
import Yarn from './managers/yarn';
import cli from './cli';
import GitLab from './vcs/gitlab';

(async () => {
  const opts = cli.parse().options;

  const options: DockerClientOptions = {
    socketPath: opts.socket,
  };
  const docker = new DockerClient(options);

  const yarn = new Yarn(docker, '/Users/jeeyo/Documents/GitHub/alfred');
  // const dependencies = await yarn.getDependencies();
  // const transitiveDependencies = await yarn.getTransitiveDependencies();

  const glab = new GitLab(docker, '/Users/jeeyo/Documents/GitHub/alfred');
  await glab.getVersion();

  // try {
  //   fastify.listen({
  //     port: 3000,
  //   });
  // } catch (err) {
  //   fastify.log.error(err);
  //   process.exit(1);
  // }
})();
