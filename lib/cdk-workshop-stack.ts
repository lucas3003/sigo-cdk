import * as cdk from '@aws-cdk/core';
import {SubnetType, Vpc, SubnetSelection, Subnet, SecurityGroup} from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as apigwv2 from '@aws-cdk/aws-apigatewayv2'
import * as rds from '@aws-cdk/aws-rds'
import * as lambda_nodejs from '@aws-cdk/aws-lambda-nodejs';
import * as sns from '@aws-cdk/aws-sns'
import * as subs from '@aws-cdk/aws-sns-subscriptions';
import { Duration } from '@aws-cdk/core';
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import { ApplicationProtocol } from "@aws-cdk/aws-elasticloadbalancingv2";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

import {DatabaseStack} from './database-stack';


export class CdkWorkshopStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const topic = new sns.Topic(this, 'Topic', {
      displayName: 'Legacy integrator topic',
      fifo: false,
      topicName: 'integratorTopic',
    })

    const industrialServicecVpc = new Vpc(this, "IndustrialServiceVpc", {
      maxAzs: 3
    })

    const industrialServiceCluster = new ecs.Cluster(this, "IndustrialServiceCluster", {
      vpc: industrialServicecVpc
    })

    //try ecs_patterns with NetworkLoadBalancer
    //https://github.com/aws-samples/aws-cdk-examples/issues/329
    const industrialServiceFargate = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "IndustrialService", {
      cluster: industrialServiceCluster,
      desiredCount: 1, //Change to 2 for HA
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../IndustrialService')
      },
      publicLoadBalancer: true,
      targetProtocol: ApplicationProtocol.HTTP,
      healthCheckGracePeriod: Duration.seconds(10000000)
    });


    new DatabaseStack(scope, "DatabaseStack", {
      readWritePermissions: [industrialServiceFargate.taskDefinition.taskRole]
    })

    //VPC Link not created for prototype. ALB will be exposed to public. I will go back to this if I have time

    const api = new apigw.RestApi(this, "industrial-api", {
      restApiName: "Industrial Service API",
      description: "Industrial Service"
    })

    const salesIntegration = new apigw.HttpIntegration(`http://${industrialServiceFargate.loadBalancer.loadBalancerDnsName}/sales`);
    const snsNotificationIntegration = new apigw.HttpIntegration(`http://${industrialServiceFargate.loadBalancer.loadBalancerDnsName}/snsnotification`, {
      httpMethod: "POST"
    });
    
    const salesResource = api.root.addResource('sales')
    salesResource.addMethod("GET", salesIntegration);

    const snsNotificationResource = api.root.addResource('snsnotification');
    snsNotificationResource.addMethod("POST", snsNotificationIntegration);
    
    const legacyIntegratorFn = new lambda_nodejs.NodejsFunction(this, 'LegacyIntegratorHandler', {
      runtime: lambda.Runtime.NODEJS_10_X,
      entry: 'lambda/legacy-receiver/legacyIntegratorHandler.js',
      handler: 'handler',
      timeout: Duration.seconds(10),
      bundling: {
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [''];
          },
          beforeInstall(inputDir: string, outputDir: string): string[] {
            return [''];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [`mkdir ${outputDir}/wsdl`, `cp ${inputDir}/lambda/legacy-receiver/wsdl/LegacyIntegrator.wsdl ${outputDir}/wsdl/LegacyIntegrator.wsdl`];
          }

        }
      },
      environment: {
        TOPIC_ARN: topic.topicArn,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
      },
    })

    const integratorApi = new apigw.RestApi(this, "integrator-api", {
      restApiName: "Integrator API",
      description: "Receive SOAP requests from Legacy Systems"
    })

    const newMessageIntegrator = new apigw.LambdaIntegration(legacyIntegratorFn, {
      proxy: true
    })

    const legacyIntegrator = integratorApi.root.addResource('message');
    legacyIntegrator.addMethod("POST", newMessageIntegrator);
    legacyIntegrator.addProxy({
      defaultIntegration: newMessageIntegrator
    });

    topic.grantPublish(legacyIntegratorFn);

    topic.addSubscription(new subs.UrlSubscription(`${api.url}snsnotification`, {
      protocol: sns.SubscriptionProtocol.HTTPS,
      
    }))
  }
}
