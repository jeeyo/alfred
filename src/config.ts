const config = {
  dockerSocketFilePath: process.env.DOCKER_SOCK || '/var/run/docker.sock',
  gitlabHost: process.env.GITLAB_HOST || 'https://gitlab.com',
  gitlabToken: process.env.GITLAB_TOKEN || '',
};

export default config;
