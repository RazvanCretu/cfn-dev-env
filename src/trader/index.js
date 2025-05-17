import { EC2Client, RunInstancesCommand } from "@aws-sdk/client-ec2";

export async function handler(e, ctx) {
  try {
    const userData = await (
      await fetch(
        "https://raw.githubusercontent.com/RazvanCretu/cfn-dev-env/main/bootstrap.ps1"
      )
    ).text();

    const client = new EC2Client({
      region: "eu-central-1",
    });

    const command = new RunInstancesCommand({
      SubnetId: "subnet-0d330933753c18d09",
      ImageId: "ami-08a270a75ca25e82a",
      MinCount: 1,
      MaxCount: 1,
      InstanceType: "t3a.large",
      SecurityGroupIds: ["sg-04f744231d34296c1"],
      InstanceInitiatedShutdownBehavior: "terminate",
      KeyName: "master",
      IamInstanceProfile: {
        Arn: process.env.PROFILE_ARN,
      },
      TagSpecifications: [
        {
          Tags: [
            {
              Key: "Name",
              Value: "Trader",
            },
          ],
          ResourceType: "instance",
        },
      ],
      UserData: Buffer.from(
        `
      <powershell>
      $env:ADMIRALS_ACCOUNT = "${process.env.ADMIRALS_ACCOUNT}"
      $env:ADMIRALS_PASS = "${process.env.ADMIRALS_PASS}"
      $env:GH_TOKEN = "${process.env.GH_TOKEN}"

      ${userData}
      </powershell>
        `
      ).toString("base64"),
    });

    const resp = await client.send(command);
    console.log(resp);
  } catch (error) {
    console.log(error);
  }
}
