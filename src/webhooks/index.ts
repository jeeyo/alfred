import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import GitLab from './gitlab';

const fastify = Fastify({ logger: true })
  .setValidatorCompiler(validatorCompiler)
  .setSerializerCompiler(serializerCompiler);

fastify.register(GitLab);
