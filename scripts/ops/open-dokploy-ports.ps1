# Open Dokploy host ports for api / worker / web (ap-south-1).
# Usage (PowerShell), with AWS credentials already configured:
#   .\scripts\ops\open-dokploy-ports.ps1
# Optional:
#   .\scripts\ops\open-dokploy-ports.ps1 -PublicIp 13.127.204.141 -Cidr 0.0.0.0/0

param(
  [string]$PublicIp = "13.127.204.141",
  [string]$Region = "ap-south-1",
  [string]$Cidr = "0.0.0.0/0",
  [int[]]$Ports = @(3001, 4000, 4001)
)

$ErrorActionPreference = "Stop"
$env:AWS_DEFAULT_REGION = $Region

$sg = aws ec2 describe-instances `
  --filters "Name=network-interface.association.public-ip,Values=$PublicIp" `
  --query "Reservations[0].Instances[0].SecurityGroups[0].GroupId" `
  --output text

if (-not $sg -or $sg -eq "None") {
  throw "No instance/security group found for public IP $PublicIp"
}

Write-Host "Instance SG: $sg"
foreach ($port in $Ports) {
  Write-Host "Authorizing tcp/$port from $Cidr ..."
  aws ec2 authorize-security-group-ingress `
    --group-id $sg `
    --ip-permissions "IpProtocol=tcp,FromPort=$port,ToPort=$port,IpRanges=[{CidrIp=$Cidr,Description='dokploy-app-port-$port'}]" `
    2>&1 | Out-Host
}

Write-Host "Current relevant ingress:"
aws ec2 describe-security-groups `
  --group-ids $sg `
  --query "SecurityGroups[0].IpPermissions[?FromPort==``80`` || FromPort==``443`` || FromPort==``3001`` || FromPort==``4000`` || FromPort==``4001``].[FromPort,ToPort,IpRanges[0].CidrIp]" `
  --output table
