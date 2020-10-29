import { IOClients, RecorderState, ServiceContext } from '@vtex/api'
import { ApolloServerHttpResponse } from 'apollo-server-core/dist/runHttpQuery'
import { GraphQLSchema } from 'graphql'

declare global {
  interface Query {
    operationName: string
    variables: Record<string, any> | string
    query: string
  }

  interface State extends RecorderState {
    query: Query
    schema: GraphQLSchema
    cacheControl: string[]
    responseInit: ApolloServerHttpResponse
  }

  type Context = ServiceContext<IOClients, State>
}
