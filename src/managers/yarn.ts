import DockerClient from '../dockerclient';

export default class Yarn extends DockerClient implements Manager {
  constructor(
    protected pwd?: string,
    protected socketPath: string = '/var/run/docker.sock'
  ) {
    super('node:lts-alpine', ['/bin/sh', '-c'], ['yarn', 'list'], pwd, socketPath);
  }

  async getDependencies(): Promise<Record<string, string>> {
    await this.run();
    return {};
  }
}
