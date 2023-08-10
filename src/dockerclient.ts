import Docker from 'dockerode';
import { Writable, WritableOptions } from 'stream';

class DockerClientStdioWritableStream extends Writable {
  private buffer = '';

  constructor(options?: WritableOptions) {
    super(options);
  }

  _write(
    chunk: any,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.buffer += chunk.toString();
    callback();
  }

  getBuffer(): string {
    return this.buffer;
  }
}

export default class DockerClient {
  private readonly docker: Docker;

  private stdout: DockerClientStdioWritableStream = new DockerClientStdioWritableStream();
  private stderr: DockerClientStdioWritableStream = new DockerClientStdioWritableStream();

  constructor(
    protected image: string,
    protected entrypoint: string[],
    protected command: string[],
    protected pwd?: string,
    protected socketPath: string = '/var/run/docker.sock',
  ) {
    this.docker = new Docker({ socketPath });
  }

  private async pull(): Promise<void> {
    await this.docker.pull(this.image);
  }

  protected async run(): Promise<void> {
    await this.pull();

    // mount volume and set working dir if specified
    const volumeMount = this.pwd
      ? {
          Volumes: { [this.pwd]: this.pwd },
          WorkingDir: this.pwd,
        }
      : {};

    const [_, container] = (await this.docker.run(
      this.image,
      this.command,
      [this.stdout, this.stderr],
      {
        Tty: false,
        Entrypoint: this.entrypoint,
        ...volumeMount,
      },
    )) as [any, Docker.Container];

    container.remove();
  }

  protected getStdout(): string {
    return this.stdout.getBuffer();
  }

  protected getStderr(): string {
    return this.stderr.getBuffer();
  }
}
