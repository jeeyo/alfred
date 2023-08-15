import DockerClient, { DockerClientOptions } from './dockerclient';
import Yarn from './managers/yarn';
import Dotnet7 from './managers/dotnet7';
import config from './config';

(async () => {
  const options: DockerClientOptions = {
    socketPath: config.dockerSocketFilePath,
  };
  const docker = new DockerClient(options);

  const dotnet = new Dotnet7(
    docker,
    '/Users/nnuntanirund/AgodaGit/revenue-management/src/Agoda.Availability.WebApi',
  );
  const dependencies = await dotnet.getDependencies();
  console.log('dotnet7', dependencies);
  // const transitiveDependencies = await dotnet.getTransitiveDependencies();

  // const yarn = new Yarn(docker, '/Users/nnuntanirund/AgodaGit/jscpd');
  // console.log('yarn', await yarn.getDependencies());

  // const glab = new GitLab(docker, '/Users/nnuntanirund/Documents/GitHub/alfred');
  // await glab.getVersion();

  // try {
  //   fastify.listen({
  //     port: 3000,
  //   });
  // } catch (err) {
  //   fastify.log.error(err);
  //   process.exit(1);
  // }
})();
