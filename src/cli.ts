import cac from 'cac';

const cli = cac();

cli
  .option('--socket <socket>', 'Docker UNIX socket file path')
  .option('--gitlabHost <gitlabHost>', 'GitLab host (e.g. https://gitlab.com)')
  .option('--gitlabToken <gitlabToken>', 'GitLab token');

export default cli;
