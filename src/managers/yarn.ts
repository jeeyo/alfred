import DockerClient, { DockerClientOptions } from '../dockerclient';
import semver from 'semver';

export default class Yarn extends DockerClient implements Manager {
  private buffer: string | null = null;

  constructor(
    protected pwd?: string,
    protected options?: DockerClientOptions,
  ) {
    super('node:lts-alpine', ['/bin/sh', '-c'], ['yarn list --depth=1'], pwd, options);
  }

  private async runIfHavent(): Promise<void> {
    if (this.buffer !== null) {
      return;
    }

    await this.run();
    this.buffer = this.getStdout();
  }

  async getDependencies(): Promise<Record<string, string>> {
    await this.runIfHavent();

    const re = new RegExp(/─ (@?.*?)@(.*?)$/gm);
    const matches = this.buffer!.matchAll(re);

    const dependencies: Record<string, string> = {};
    for (const match of matches) {
      const [, name, version] = match;
      dependencies[name] = version;
    }

    return dependencies;
  }

  async getTransitiveDependencies(): Promise<Record<string, string | null>> {
    await this.runIfHavent();

    const re = new RegExp(/  (├|└)─ (@?.*?)@(.*?)$/gm);
    const matches = this.buffer!.matchAll(re);

    const dependencies: Record<string, string | null> = {};
    for (const match of matches) {
      const [, , name, version] = match;
      dependencies[name] = semver.clean(version);
      console.log(`transitive: ${name} ${version}`);
    }

    return dependencies;
  }
}
