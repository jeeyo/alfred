import Docker from 'dockerode';
import { IncomingMessage } from 'http';

export interface DockerClientOptions {
  socketPath?: string;
}

export default class DockerClient {
  private readonly docker: Docker;

  constructor(protected options?: DockerClientOptions) {
    this.docker = new Docker(options);
  }

  async listImages(): Promise<string[][]> {
    const images = await this.docker.listImages();
    return images
      .map((image) => image.RepoTags ?? [])
      .filter((image) => image.length > 0);
  }

  async pull(image: string): Promise<void> {
    const message: IncomingMessage = await this.docker.pull(image);
    await new Promise((resolve, reject) => {
      message.on('close', () => resolve(true));
      message.socket.on('close', (hadError) => hadError && reject());
    });
  }

  async run(
    image: string,
    entrypoint: string[],
    command: string[],
    pwd?: string,
    env?: string[],
  ): Promise<[Buffer, Buffer]> {
    // mount volume and set working dir if specified
    const volumeMount = pwd
      ? {
          HostConfig: {
            Binds: [`${pwd}:${pwd}`],
          },
          WorkingDir: pwd,
        }
      : {};

    const [_, container] = (await this.docker.run(image, command ?? [], [], {
      Entrypoint: entrypoint,
      Env: env,
      ...volumeMount,
    })) as [any, Docker.Container];

    const stdout = await container.logs({ follow: false, stdout: true, stderr: false });
    const stderr = await container.logs({ follow: false, stdout: false, stderr: true });

    container.remove();

    return [stdout, stderr];
  }
}
