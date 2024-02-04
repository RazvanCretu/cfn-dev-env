// const sqs = require('aws-cdk-lib/aws-sqs');
import { CfnOutput, Stack } from "aws-cdk-lib";
import {
  Vpc,
  IpAddresses,
  SubnetType,
  GatewayVpcEndpointAwsService,
  SecurityGroup,
  Peer,
  Port,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  MachineImage,
  KeyPair,
  CfnEIP,
} from "aws-cdk-lib/aws-ec2";
import { Role } from "aws-cdk-lib/aws-iam";

export class DevStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new Vpc(this, "VPC-Dev", {
      vpcName: "dev-vpc",
      ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 20,
          name: "Public-",
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 20,
          name: "Private-",
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
      gatewayEndpoints: {
        S3: {
          service: GatewayVpcEndpointAwsService.S3,
          subnets: [{ subnetType: SubnetType.PRIVATE_ISOLATED }],
        },
      },
    });

    const sg = new SecurityGroup(this, "DevSecurityGroup", {
      vpc,
      securityGroupName: "dev-sg",
      description:
        "Security Group to use when accessing resources in this vpc from personal computer.",
    });

    sg.addIngressRule(
      Peer.ipv4(`${process.env.PERSONAL_IP}/32`),
      Port.tcp(22),
      "SSH from personal computer."
    );

    const instance = new Instance(this, "Instance-Dev", {
      vpc: vpc,
      role: Role.fromRoleName(this, "my-role", process.env.AWS_EC2_PROFILE),
      securityGroup: sg,
      instanceName: "dev-master",
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MEDIUM),
      machineImage: MachineImage.genericLinux({
        "eu-central-1": "ami-0faab6bdbac9486fb",
      }),
      requireImdsv2: true,
      keyPair: KeyPair.fromKeyPairName(
        this,
        "KeyPair",
        process.env.AWS_EC2_KEY
      ), // Create this in the console before deploying
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC, // This is need in order for SubnetFilters to be able to find public Subnets
        // subnetFilters: [
        //   ec2.SubnetFilter.byIds(
        //     "subnet-031e2d9267d8d6516"
        //     // "subnet-0595c3ffd520b3726"
        //   ),
        // ],
      },
    });

    instance.addUserData(
      `curl '${process.env.AWS_EC2_USERDATA}' -o './bootstrap.sh' && sh ./bootstrap.sh && rm -rf ./bootstrap.sh`,
      `su - ubuntu -c "git config --global user.name '${process.env.GIT_USER}' && git config --global user.email '${process.env.GIT_EMAIL}'"`
    );

    new CfnEIP(this, "ElasticIP", { instanceId: instance.instanceId });

    new CfnOutput(this, "PublicIP", {
      value: instance.instancePublicIp,
    });
  }
}

export default { DevStack };
