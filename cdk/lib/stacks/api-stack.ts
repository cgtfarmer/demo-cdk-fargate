import { Duration, Size, Stack, StackProps } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, Port, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import {
  AwsLogDriverMode, Cluster, ContainerImage, LogDrivers, FargateService, FargateTaskDefinition, Protocol
} from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

interface ApiStackProps extends StackProps {
  ecrRepository: Repository;
}

export class ApiStack extends Stack {

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'Vpc', {
      maxAzs: 1,
    });

    // Can use the default VPC instead:
    // const vpc = Vpc.fromLookup(this, 'Vpc', {
    //   isDefault: true,
    // });

    const cluster = new Cluster(this, 'Cluster', {
      vpc: vpc,
      capacity: {
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.NANO),
        desiredCapacity: 1,
        maxCapacity: 1,
      }
    });

    const taskDefinition = new FargateTaskDefinition(this, 'TaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    taskDefinition.addContainer('DefaultContainer', {
      image: ContainerImage.fromEcrRepository(props.ecrRepository, 'latest'),
      memoryLimitMiB: 512,
      logging: LogDrivers.awsLogs({
        streamPrefix: 'TestStreamPrefix',
        mode: AwsLogDriverMode.NON_BLOCKING,
        maxBufferSize: Size.mebibytes(25),
      }),
      portMappings: [ { containerPort: 80, protocol: Protocol.TCP, } ],
      healthCheck: {
        command: [ "CMD-SHELL", "curl -f http://localhost/health || exit 1" ],
        interval: Duration.minutes(1),
        retries: 3,
        startPeriod: Duration.minutes(1),
        timeout: Duration.minutes(1),
      }
    });

    const fargateService = new FargateService(this, 'FargateService', {
      cluster,
      taskDefinition,
      assignPublicIp: true,
    });

    fargateService.connections.allowFromAnyIpv4(Port.tcp(80));
  }
}
