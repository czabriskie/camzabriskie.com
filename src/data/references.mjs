// Every source a primer cites, defined once (Decision 0007). Primers cite with [@key] in
// markdown; src/lib/remark-citations.mjs turns that into an IEEE-style [n] and appends a
// numbered References section, and /primers/references/ lists everything that's cited.
//
// Only list a source that was actually read while writing, and that supports what it's
// cited for. `accessed` is the date it was last checked.
//
// Fields: authors (array of people, or one organization string), title, container (the
// larger work, italicized: a user guide, a report series), note (plain text after the
// title, like "RFC 1918, IETF"), date, url, accessed (YYYY-MM-DD).

const AWS = 'Amazon Web Services';
const VPC_GUIDE = 'Amazon VPC User Guide';
const CHECKED = '2026-10-05';

const rfc = (n, authors, title, date) => ({
  authors,
  title,
  note: `RFC ${n}, Internet Engineering Task Force`,
  date,
  url: `https://www.rfc-editor.org/rfc/rfc${n}`,
  accessed: CHECKED,
});

const aws = (title, container, url) => ({ authors: AWS, title, container, url, accessed: CHECKED });

export const references = {
  // RFCs
  rfc768: rfc(768, ['J. Postel'], 'User Datagram Protocol', 'Aug. 1980'),
  rfc791: rfc(791, ['J. Postel'], 'Internet Protocol', 'Sep. 1981'),
  rfc792: rfc(792, ['J. Postel'], 'Internet Control Message Protocol', 'Sep. 1981'),
  rfc826: rfc(826, ['D. Plummer'], 'An Ethernet Address Resolution Protocol: Or Converting Network Protocol Addresses to 48.bit Ethernet Address for Transmission on Ethernet Hardware', 'Nov. 1982'),
  rfc1034: rfc(1034, ['P. Mockapetris'], 'Domain names - concepts and facilities', 'Nov. 1987'),
  rfc1035: rfc(1035, ['P. Mockapetris'], 'Domain names - implementation and specification', 'Nov. 1987'),
  rfc2246: rfc(2246, ['T. Dierks', 'C. Allen'], 'The TLS Protocol Version 1.0', 'Jan. 1999'),
  rfc2308: rfc(2308, ['M. Andrews'], 'Negative Caching of DNS Queries (DNS NCACHE)', 'Mar. 1998'),
  rfc3439: rfc(3439, ['R. Bush', 'D. Meyer'], 'Some Internet Architectural Guidelines and Philosophy', 'Dec. 2002'),
  rfc3596: rfc(3596, ['S. Thomson', 'C. Huitema', 'V. Ksinant', 'M. Souissi'], 'DNS Extensions to Support IP Version 6', 'Oct. 2003'),
  rfc1122: rfc(1122, ['R. Braden, Ed.'], 'Requirements for Internet Hosts - Communication Layers', 'Oct. 1989'),
  rfc1928: rfc(1928, ['M. Leech', 'M. Ganis', 'Y. Lee', 'R. Kuris', 'D. Koblas', 'L. Jones'], 'SOCKS Protocol Version 5', 'Mar. 1996'),
  rfc1918: rfc(1918, ['Y. Rekhter', 'B. Moskowitz', 'D. Karrenberg', 'G. J. de Groot', 'E. Lear'], 'Address Allocation for Private Internets', 'Feb. 1996'),
  rfc3021: rfc(3021, ['A. Retana', 'R. White', 'V. Fuller', 'D. McPherson'], 'Using 31-Bit Prefixes on IPv4 Point-to-Point Links', 'Dec. 2000'),
  rfc3849: rfc(3849, ['G. Huston', 'A. Lord', 'P. Smith'], 'IPv6 Address Prefix Reserved for Documentation', 'Jul. 2004'),
  rfc4291: rfc(4291, ['R. Hinden', 'S. Deering'], 'IP Version 6 Addressing Architecture', 'Feb. 2006'),
  rfc4632: rfc(4632, ['V. Fuller', 'T. Li'], 'Classless Inter-domain Routing (CIDR): The Internet Address Assignment and Aggregation Plan', 'Aug. 2006'),
  rfc5280: rfc(5280, ['D. Cooper', 'S. Santesson', 'S. Farrell', 'S. Boeyen', 'R. Housley', 'W. Polk'], 'Internet X.509 Public Key Infrastructure Certificate and Certificate Revocation List (CRL) Profile', 'May 2008'),
  rfc5737: rfc(5737, ['J. Arkko', 'M. Cotton', 'L. Vegoda'], 'IPv4 Address Blocks Reserved for Documentation', 'Jan. 2010'),
  rfc6066: rfc(6066, ['D. Eastlake 3rd'], 'Transport Layer Security (TLS) Extensions: Extension Definitions', 'Jan. 2011'),
  rfc7239: rfc(7239, ['A. Petersson', 'M. Nilsson'], 'Forwarded HTTP Extension', 'Jun. 2014'),
  rfc8200: rfc(8200, ['S. Deering', 'R. Hinden'], 'Internet Protocol, Version 6 (IPv6) Specification', 'Jul. 2017'),
  rfc8446: rfc(8446, ['E. Rescorla'], 'The Transport Layer Security (TLS) Protocol Version 1.3', 'Aug. 2018'),
  rfc8484: rfc(8484, ['P. Hoffman', 'P. McManus'], 'DNS Queries over HTTPS (DoH)', 'Oct. 2018'),
  rfc8555: rfc(8555, ['R. Barnes', 'J. Hoffman-Andrews', 'D. McCarney', 'J. Kasten'], 'Automatic Certificate Management Environment (ACME)', 'Mar. 2019'),
  rfc8659: rfc(8659, ['P. Hallam-Baker', 'R. Stradling', 'J. Hoffman-Andrews'], 'DNS Certification Authority Authorization (CAA) Resource Record', 'Nov. 2019'),
  rfc9000: rfc(9000, ['J. Iyengar, Ed.', 'M. Thomson, Ed.'], 'QUIC: A UDP-Based Multiplexed and Secure Transport', 'May 2021'),
  rfc9001: rfc(9001, ['M. Thomson, Ed.', 'S. Turner, Ed.'], 'Using TLS to Secure QUIC', 'May 2021'),
  rfc9110: rfc(9110, ['R. Fielding, Ed.', 'M. Nottingham, Ed.', 'J. Reschke, Ed.'], 'HTTP Semantics', 'Jun. 2022'),
  rfc9114: rfc(9114, ['M. Bishop, Ed.'], 'HTTP/3', 'Jun. 2022'),
  rfc9293: rfc(9293, ['W. Eddy, Ed.'], 'Transmission Control Protocol (TCP)', 'Aug. 2022'),
  rfc9111: rfc(9111, ['R. Fielding, Ed.', 'M. Nottingham, Ed.', 'J. Reschke, Ed.'], 'HTTP Caching', 'Jun. 2022'),

  // Other standards and announcements
  'itu-x200': {
    authors: 'ITU-T',
    title: 'Information technology - Open Systems Interconnection - Basic Reference Model: The basic model',
    note: 'ITU-T Recommendation X.200, International Telecommunication Union',
    date: 'Jul. 1994',
    url: 'https://www.itu.int/rec/T-REC-X.200-199407-I/en',
    accessed: CHECKED,
  },
  'nist-sp-800-207': {
    authors: ['S. Rose', 'O. Borchert', 'S. Mitchell', 'S. Connelly'],
    title: 'Zero Trust Architecture',
    note: 'NIST Special Publication 800-207, National Institute of Standards and Technology',
    date: 'Aug. 2020',
    url: 'https://csrc.nist.gov/pubs/sp/800/207/final',
    accessed: CHECKED,
  },
  'nro-ipv4-depleted': {
    authors: 'Number Resource Organization',
    title: 'Free Pool of IPv4 Address Space Depleted',
    date: 'Feb. 3, 2011',
    url: 'https://www.nro.net/ipv4-free-pool-depleted/',
    accessed: CHECKED,
  },

  // Amazon VPC
  'aws-vpc-subnet-sizing': aws('Subnet CIDR blocks', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html'),
  'aws-vpc-cidr-blocks': aws('VPC CIDR blocks', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html'),
  'aws-vpc-subnets': aws('Subnets for your VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html'),
  'aws-vpc-route-tables': aws('Configure route tables', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html'),
  'aws-vpc-route-priority': aws('How route priority works', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/route-tables-priority.html'),
  'aws-vpc-routing-options': aws('Example routing options', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html'),
  'aws-vpc-nacls': aws('Control subnet traffic with network access control lists', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html'),
  'aws-vpc-default-nacl': aws('Default network ACL for a VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/default-network-acl.html'),
  'aws-vpc-custom-nacl': aws('Custom network ACLs for your VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html'),
  'aws-vpc-security-groups': aws('Control traffic to your AWS resources using security groups', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html'),
  'aws-vpc-infrastructure-security': aws('Infrastructure security in Amazon VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html'),
  'aws-vpc-quotas': aws('Amazon VPC quotas', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/amazon-vpc-limits.html'),
  'aws-vpc-nat-gateways': aws('NAT gateways', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html'),
  'aws-vpc-regional-nat': aws('Regional NAT gateways for automatic multi-AZ expansion', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateways-regional.html'),
  'aws-vpc-faq': aws('Amazon VPC FAQs', undefined, 'https://aws.amazon.com/vpc/faqs/'),
  'aws-vpc-peering': aws('How VPC peering connections work', 'Amazon VPC Peering Guide', 'https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html'),
  'aws-tgw-vpc-attachments': aws('Amazon VPC attachments in AWS Transit Gateway', 'Amazon VPC Transit Gateways', 'https://docs.aws.amazon.com/vpc/latest/tgw/tgw-vpc-attachments.html'),
  'aws-eks-vpc-cni': aws('Assign IPs to Pods with the Amazon VPC CNI', 'Amazon EKS User Guide', 'https://docs.aws.amazon.com/eks/latest/userguide/managing-vpc-cni.html'),

  'root-servers': { authors: 'Root Server Technical Operations Association', title: 'Root Servers', url: 'https://root-servers.org/', accessed: CHECKED },

  // DNS and Route 53
  'aws-route53-concepts': aws('Amazon Route 53 concepts', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/route-53-concepts.html'),
  'aws-route53-public-zones': aws('Considerations when working with public hosted zones', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zone-public-considerations.html'),
  'aws-route53-private-zones': aws('Working with private hosted zones', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-private.html'),
  'aws-route53-routing-policies': aws('Choosing a routing policy', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html'),
  'aws-route53-resolver': aws('What is Route 53 VPC Resolver?', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html'),

  // CDNs and CloudFront
  'aws-cloudfront-intro': aws('What is Amazon CloudFront?', 'Amazon CloudFront Developer Guide', 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html'),
  'aws-cloudfront-cache-key': aws('Understand the cache key', 'Amazon CloudFront Developer Guide', 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-the-cache-key.html'),
  'aws-cloudfront-expiration': aws('Manage how long content stays in the cache (expiration)', 'Amazon CloudFront Developer Guide', 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html'),
  'aws-cloudfront-invalidation': aws('Invalidate files to remove content', 'Amazon CloudFront Developer Guide', 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html'),
  'aws-cloudfront-s3-oac': aws('Restrict access to an Amazon S3 origin', 'Amazon CloudFront Developer Guide', 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html'),
  'aws-cloudfront-vpc-origins': aws('Restrict access with VPC origins', 'Amazon CloudFront Developer Guide', 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html'),
  'aws-cloudfront-cert-requirements': aws('Requirements for using SSL/TLS certificates with CloudFront', 'Amazon CloudFront Developer Guide', 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html'),
  'aws-cloudfront-cache-tags-blog': {
    authors: AWS,
    title: 'Automate streaming content refresh with Amazon CloudFront cache tags',
    container: 'AWS for M&E Blog',
    url: 'https://aws.amazon.com/blogs/media/automate-streaming-content-refresh-with-amazon-cloudfront-cache-tags/',
    accessed: CHECKED,
  },
  'aws-cloudfront-faq': aws('Amazon CloudFront FAQs', undefined, 'https://aws.amazon.com/cloudfront/faqs/'),
  'aws-cloudfront-alb-origin': aws('AWS WAF IPSet rules for ALB behind CloudFront', 'AWS re:Post Knowledge Center', 'https://repost.aws/knowledge-center/waf-ipset-rules-alb-cloudfront'),
  'aws-s3-endpoints': aws('Amazon Simple Storage Service endpoints and quotas', 'AWS General Reference', 'https://docs.aws.amazon.com/general/latest/gr/s3.html'),
  'aws-shield': aws('AWS Shield', 'AWS WAF, AWS Firewall Manager, and AWS Shield Developer Guide', 'https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html'),

  // Load balancing and WAF
  'aws-nlb-listeners': aws('Listeners for your Network Load Balancers', 'Elastic Load Balancing User Guide for Network Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-listeners.html'),
  'aws-nlb-intro': aws('What is a Network Load Balancer?', 'Elastic Load Balancing User Guide for Network Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html'),
  'aws-gwlb-intro': aws('What is a Gateway Load Balancer?', 'Elastic Load Balancing User Guide for Gateway Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/gateway/introduction.html'),
  'aws-alb-intro': aws('What is an Application Load Balancer?', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html'),
  'aws-alb-target-groups': aws('Target groups for your Application Load Balancers', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html'),
  'aws-alb-mtls': aws('Mutual authentication with TLS in Application Load Balancer', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/mutual-authentication.html'),
  'aws-waf-resources': aws('Resources that you can protect with AWS WAF', 'AWS WAF Developer Guide', 'https://docs.aws.amazon.com/waf/latest/developerguide/how-aws-waf-works-resources.html'),

  // Certificates and DNS
  'aws-route53-alias': aws('Choosing between alias and non-alias records', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html'),
  'aws-acm-caa': aws('Certification Authority Authorization (CAA) problems', 'AWS Certificate Manager User Guide', 'https://docs.aws.amazon.com/acm/latest/userguide/troubleshooting-caa.html'),
  'aws-acm-exportable': aws('AWS Certificate Manager exportable public certificates', 'AWS Certificate Manager User Guide', 'https://docs.aws.amazon.com/acm/latest/userguide/acm-exportable-certificates.html'),
  'aws-acm-exportable-blog': {
    authors: AWS,
    title: 'AWS Certificate Manager introduces exportable public SSL/TLS certificates to use anywhere',
    container: 'AWS News Blog',
    url: 'https://aws.amazon.com/blogs/aws/aws-certificate-manager-introduces-exportable-public-ssl-tls-certificates-to-use-anywhere/',
    accessed: CHECKED,
  },
  'aws-acm-dns-renewal': aws('Renewal for domains validated by DNS', 'AWS Certificate Manager User Guide', 'https://docs.aws.amazon.com/acm/latest/userguide/dns-renewal-validation.html'),
  'aws-acm-pricing': aws('AWS Certificate Manager Pricing', undefined, 'https://aws.amazon.com/certificate-manager/pricing/'),
  'aws-acm-faq': aws('AWS Certificate Manager FAQs', undefined, 'https://aws.amazon.com/certificate-manager/faqs/'),
  'letsencrypt-challenges': { authors: "Let's Encrypt", title: 'Challenge Types', url: 'https://letsencrypt.org/docs/challenge-types/', accessed: CHECKED },
  'caddy-automatic-https': { authors: 'Caddy', title: 'Automatic HTTPS', container: 'Caddy Documentation', url: 'https://caddyserver.com/docs/automatic-https', accessed: CHECKED },
  'mdn-x-forwarded-for': { authors: 'MDN contributors', title: 'X-Forwarded-For header', container: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For', accessed: CHECKED },
  'mdn-proxies': { authors: 'MDN contributors', title: 'Proxy servers and tunneling', container: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Proxy_servers_and_tunneling', accessed: CHECKED },
  'curl-proxy-env': { authors: 'D. Stenberg', title: 'Proxy environment variables', container: 'Everything curl', url: 'https://everything.curl.dev/usingcurl/proxies/env.html', accessed: CHECKED },
  'python-requests-advanced': { authors: 'Python Software Foundation', title: 'Advanced Usage', container: 'Requests Documentation', url: 'https://requests.readthedocs.io/en/latest/user/advanced/', accessed: CHECKED },
  'python-ipaddress': { authors: 'Python Software Foundation', title: 'ipaddress: IPv4/IPv6 manipulation library', container: 'The Python Standard Library', url: 'https://docs.python.org/3/library/ipaddress.html', accessed: CHECKED },
  'node-cli': { authors: 'OpenJS Foundation', title: 'Command-line API', container: 'Node.js Documentation', url: 'https://nodejs.org/api/cli.html', accessed: CHECKED },
  'java-keytool': { authors: 'Oracle', title: 'The keytool Command', container: 'Java SE 21 Tool Specifications', url: 'https://docs.oracle.com/en/java/javase/21/docs/specs/man/keytool.html', accessed: CHECKED },
  'trino-jdbc': { authors: 'Trino Software Foundation', title: 'JDBC driver', container: 'Trino Documentation', url: 'https://trino.io/docs/current/client/jdbc.html', accessed: CHECKED },
  'openssl-s-client': { authors: 'OpenSSL Project', title: 'openssl-s_client', container: 'OpenSSL Documentation', url: 'https://docs.openssl.org/master/man1/openssl-s_client/', accessed: CHECKED },

  // Reaching private resources
  'aws-s2s-vpn-what-is': aws('What is AWS Site-to-Site VPN?', 'AWS Site-to-Site VPN User Guide', 'https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html'),
  'aws-s2s-vpn-resilience': aws('Resilience in AWS Site-to-Site VPN', 'AWS Site-to-Site VPN User Guide', 'https://docs.aws.amazon.com/vpn/latest/s2svpn/disaster-recovery-resiliency.html'),
  'aws-dx-encryption': aws('Establish an AWS VPN using Direct Connect', 'AWS re:Post Knowledge Center', 'https://repost.aws/knowledge-center/create-vpn-direct-connect'),
  'aws-client-vpn-access': aws('Provide Client VPN users with access to AWS resources', 'AWS re:Post Knowledge Center', 'https://repost.aws/knowledge-center/client-vpn-give-users-resource-access'),
  'aws-client-vpn-auth-rules': aws('AWS Client VPN authorization rules', 'AWS Client VPN Administrator Guide', 'https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/cvpn-working-rules.html'),
  'aws-ssm-session-manager': aws('AWS Systems Manager Session Manager', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html'),
  'aws-ssm-start-session': aws('Start a session', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html'),
  'aws-ec2-instance-connect-endpoint': aws('Connect to your instances using a private IP address and EC2 Instance Connect Endpoint', 'Amazon EC2 User Guide', 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-with-ec2-instance-connect-endpoint.html'),
  'openssh-ssh': { authors: 'OpenBSD', title: 'ssh(1)', container: 'OpenBSD manual pages', url: 'https://man.openbsd.org/ssh', accessed: CHECKED },
  'k8s-port-forward': { authors: 'The Kubernetes Authors', title: 'Use Port Forwarding to Access Applications in a Cluster', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/', accessed: CHECKED },
  'socat-manual': { authors: 'G. Rieger', title: 'socat - Multipurpose relay', container: 'socat documentation', url: 'http://www.dest-unreach.org/socat/doc/socat.html', accessed: CHECKED },
};

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
const fmtAccessed = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** IEEE author list: "A", "A and B", "A, B, and C"; more than six becomes "A et al." */
function fmtAuthors(authors) {
  if (typeof authors === 'string') return authors;
  if (authors.length > 6) return `${authors[0]} et al.`;
  if (authors.length <= 2) return authors.join(' and ');
  return `${authors.slice(0, -1).join(', ')}, and ${authors[authors.length - 1]}`;
}

/** One reference in IEEE style, as an HTML string (no surrounding element, no [n]). */
export function formatReference(ref) {
  const after = [];
  if (ref.container) after.push(`<i>${esc(ref.container)}</i>`);
  if (ref.note) after.push(esc(ref.note));
  if (ref.date) after.push(esc(ref.date));
  // IEEE puts the comma (or the period, when nothing follows) inside the quotes.
  // A title ending in its own "?" or "!" takes no extra punctuation.
  const punct = /[?!]$/.test(ref.title) ? '' : after.length ? ',' : '.';
  let out = `${esc(fmtAuthors(ref.authors))}, “${esc(ref.title)}${punct}”`;
  if (after.length) out += ` ${after.join(', ')}.`;
  if (ref.accessed) out += ` Accessed: ${fmtAccessed(ref.accessed)}.`;
  out += ` [Online]. Available: <a href="${esc(ref.url)}">${esc(ref.url)}</a>`;
  return out;
}
