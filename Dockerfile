FROM public.ecr.aws/lambda/nodejs:22

RUN npm install -g pnpm

COPY . ${LAMBDA_TASK_ROOT}/

RUN pnpm install --frozen-lockfile --prod

CMD ["index.handler"]
