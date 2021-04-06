import * as cdk from '@aws-cdk/core'
import * as iam from '@aws-cdk/aws-iam';
import * as dynamodb from "@aws-cdk/aws-dynamodb";

interface DatabaseStackProps extends cdk.StackProps {
    readWritePermissions: iam.IRole[]
}

export class DatabaseStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: DatabaseStackProps) {
        super(scope, id, props);

        const tables = [
            {
                name: "Sales",
                partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
                sortKey: {name: "productId", type:dynamodb.AttributeType.STRING}
            },
            {
                name: "Supplies",
                partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
                sortKey: { name: "qty", type: dynamodb.AttributeType.NUMBER }
            }
        ]

        tables.forEach(async table => {
            const t = await this.createTable(table.name, table.partitionKey, table.sortKey);    
            props?.readWritePermissions.forEach(permission => 
                t.grantReadWriteData(permission)
            );    
        });
    }

    async createTable(name: string, partitionKey: any, sortKey: any) {
        return new dynamodb.Table(this, name, {
            tableName: name,
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey,
            sortKey,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
    }
}