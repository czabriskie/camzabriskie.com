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

// Philosophy sources: the Stanford Encyclopedia of Philosophy (dated by its last
// substantive revision) and the Internet Encyclopedia of Philosophy.
const PHIL = '2026-10-08';
const IEP = 'Internet Encyclopedia of Philosophy';
const sep = (authors, title, date, slug) => ({
  authors,
  title,
  container: 'The Stanford Encyclopedia of Philosophy',
  date,
  url: `https://plato.stanford.edu/entries/${slug}/`,
  accessed: PHIL,
});

export const references = {
  // RFCs
  rfc768: rfc(768, ['J. Postel'], 'User Datagram Protocol', 'Aug. 1980'),
  rfc791: rfc(791, ['J. Postel'], 'Internet Protocol', 'Sep. 1981'),
  rfc792: rfc(792, ['J. Postel'], 'Internet Control Message Protocol', 'Sep. 1981'),
  rfc826: rfc(826, ['D. Plummer'], 'An Ethernet Address Resolution Protocol: Or Converting Network Protocol Addresses to 48.bit Ethernet Address for Transmission on Ethernet Hardware', 'Nov. 1982'),
  rfc1034: rfc(1034, ['P. Mockapetris'], 'Domain names - concepts and facilities', 'Nov. 1987'),
  rfc1035: rfc(1035, ['P. Mockapetris'], 'Domain names - implementation and specification', 'Nov. 1987'),
  rfc2131: rfc(2131, ['R. Droms'], 'Dynamic Host Configuration Protocol', 'Mar. 1997'),
  rfc2132: rfc(2132, ['S. Alexander', 'R. Droms'], 'DHCP Options and BOOTP Vendor Extensions', 'Mar. 1997'),
  rfc2246: rfc(2246, ['T. Dierks', 'C. Allen'], 'The TLS Protocol Version 1.0', 'Jan. 1999'),
  rfc2308: rfc(2308, ['M. Andrews'], 'Negative Caching of DNS Queries (DNS NCACHE)', 'Mar. 1998'),
  rfc3022: rfc(3022, ['P. Srisuresh', 'K. Egevang'], 'Traditional IP Network Address Translator (Traditional NAT)', 'Jan. 2001'),
  rfc3596: rfc(3596, ['S. Thomson', 'C. Huitema', 'V. Ksinant', 'M. Souissi'], 'DNS Extensions to Support IP Version 6', 'Oct. 2003'),
  rfc1122: rfc(1122, ['R. Braden, Ed.'], 'Requirements for Internet Hosts - Communication Layers', 'Oct. 1989'),
  rfc1928: rfc(1928, ['M. Leech', 'M. Ganis', 'Y. Lee', 'R. Kuris', 'D. Koblas', 'L. Jones'], 'SOCKS Protocol Version 5', 'Mar. 1996'),
  rfc1918: rfc(1918, ['Y. Rekhter', 'B. Moskowitz', 'D. Karrenberg', 'G. J. de Groot', 'E. Lear'], 'Address Allocation for Private Internets', 'Feb. 1996'),
  rfc3021: rfc(3021, ['A. Retana', 'R. White', 'V. Fuller', 'D. McPherson'], 'Using 31-Bit Prefixes on IPv4 Point-to-Point Links', 'Dec. 2000'),
  rfc3849: rfc(3849, ['G. Huston', 'A. Lord', 'P. Smith'], 'IPv6 Address Prefix Reserved for Documentation', 'Jul. 2004'),
  rfc4291: rfc(4291, ['R. Hinden', 'S. Deering'], 'IP Version 6 Addressing Architecture', 'Feb. 2006'),
  rfc4861: rfc(4861, ['T. Narten', 'E. Nordmark', 'W. Simpson', 'H. Soliman'], 'Neighbor Discovery for IP version 6 (IPv6)', 'Sep. 2007'),
  rfc4632: rfc(4632, ['V. Fuller', 'T. Li'], 'Classless Inter-domain Routing (CIDR): The Internet Address Assignment and Aggregation Plan', 'Aug. 2006'),
  rfc5280: rfc(5280, ['D. Cooper', 'S. Santesson', 'S. Farrell', 'S. Boeyen', 'R. Housley', 'W. Polk'], 'Internet X.509 Public Key Infrastructure Certificate and Certificate Revocation List (CRL) Profile', 'May 2008'),
  rfc5737: rfc(5737, ['J. Arkko', 'M. Cotton', 'L. Vegoda'], 'IPv4 Address Blocks Reserved for Documentation', 'Jan. 2010'),
  rfc6066: rfc(6066, ['D. Eastlake 3rd'], 'Transport Layer Security (TLS) Extensions: Extension Definitions', 'Jan. 2011'),
  rfc7239: rfc(7239, ['A. Petersson', 'M. Nilsson'], 'Forwarded HTTP Extension', 'Jun. 2014'),
  rfc7766: rfc(7766, ['J. Dickinson', 'S. Dickinson', 'R. Bellis', 'A. Mankin', 'D. Wessels'], 'DNS Transport over TCP - Implementation Requirements', 'Mar. 2016'),
  rfc8200: rfc(8200, ['S. Deering', 'R. Hinden'], 'Internet Protocol, Version 6 (IPv6) Specification', 'Jul. 2017'),
  rfc8446: rfc(8446, ['E. Rescorla'], 'The Transport Layer Security (TLS) Protocol Version 1.3', 'Aug. 2018'),
  rfc9846: rfc(9846, ['E. Rescorla'], 'The Transport Layer Security (TLS) Protocol Version 1.3', 'Jul. 2026'),
  rfc8484: rfc(8484, ['P. Hoffman', 'P. McManus'], 'DNS Queries over HTTPS (DoH)', 'Oct. 2018'),
  rfc8737: rfc(8737, ['R.B. Shoemaker'], 'Automated Certificate Management Environment (ACME) TLS Application-Layer Protocol Negotiation (ALPN) Challenge Extension', 'Feb. 2020'),
  rfc8555: rfc(8555, ['R. Barnes', 'J. Hoffman-Andrews', 'D. McCarney', 'J. Kasten'], 'Automatic Certificate Management Environment (ACME)', 'Mar. 2019'),
  rfc8659: rfc(8659, ['P. Hallam-Baker', 'R. Stradling', 'J. Hoffman-Andrews'], 'DNS Certification Authority Authorization (CAA) Resource Record', 'Nov. 2019'),
  rfc9162: rfc(9162, ['B. Laurie', 'E. Messeri', 'R. Stradling'], 'Certificate Transparency Version 2.0', 'Dec. 2021'),
  rfc9525: rfc(9525, ['P. Saint-Andre', 'R. Salz'], 'Service Identity in TLS', 'Nov. 2023'),
  rfc9000: rfc(9000, ['J. Iyengar, Ed.', 'M. Thomson, Ed.'], 'QUIC: A UDP-Based Multiplexed and Secure Transport', 'May 2021'),
  rfc9001: rfc(9001, ['M. Thomson, Ed.', 'S. Turner, Ed.'], 'Using TLS to Secure QUIC', 'May 2021'),
  rfc9110: rfc(9110, ['R. Fielding, Ed.', 'M. Nottingham, Ed.', 'J. Reschke, Ed.'], 'HTTP Semantics', 'Jun. 2022'),
  rfc9114: rfc(9114, ['M. Bishop, Ed.'], 'HTTP/3', 'Jun. 2022'),
  rfc9542: rfc(9542, ['D. Eastlake 3rd', 'J. Abley', 'Y. Li'], 'IANA Considerations and IETF Protocol and Documentation Usage for IEEE 802 Parameters', 'Apr. 2024'),
  rfc9293: rfc(9293, ['W. Eddy, Ed.'], 'Transmission Control Protocol (TCP)', 'Aug. 2022'),
  rfc9111: rfc(9111, ['R. Fielding, Ed.', 'M. Nottingham, Ed.', 'J. Reschke, Ed.'], 'HTTP Caching', 'Jun. 2022'),
  rfc5246: rfc(5246, ['T. Dierks', 'E. Rescorla'], 'The Transport Layer Security (TLS) Protocol Version 1.2', 'Aug. 2008'),
  rfc7301: rfc(7301, ['S. Friedl', 'A. Popov', 'A. Langley', 'E. Stephan'], 'Transport Layer Security (TLS) Application-Layer Protocol Negotiation Extension', 'Jul. 2014'),
  rfc7748: rfc(7748, ['A. Langley', 'M. Hamburg', 'S. Turner'], 'Elliptic Curves for Security', 'Jan. 2016'),
  rfc8996: rfc(8996, ['K. Moriarty', 'S. Farrell'], 'Deprecating TLS 1.0 and TLS 1.1', 'Mar. 2021'),
  rfc9849: rfc(9849, ['E. Rescorla', 'K. Oku', 'N. Sullivan', 'C. A. Wood'], 'TLS Encrypted Client Hello', 'Mar. 2026'),
  'wireshark-tls': { authors: 'Wireshark Foundation', title: 'TLS', container: 'Wireshark Wiki', url: 'https://wiki.wireshark.org/TLS', accessed: '2026-10-06' },
  rfc5116: rfc(5116, ['D. McGrew'], 'An Interface and Algorithms for Authenticated Encryption', 'Jan. 2008'),
  rfc10024: rfc(10024, ['K. Kwiatkowski', 'P. Kampanakis', 'B. E. Westerbaan', 'D. Stebila'], 'Post-Quantum Traditional (PQ/T) Hybrid Key Agreement Mechanisms for TLS 1.3', 'Aug. 2026'),
  'nist-sp-800-175b': {
    authors: ['E. Barker'],
    title: 'Guideline for Using Cryptographic Standards in the Federal Government: Cryptographic Mechanisms',
    note: 'NIST Special Publication 800-175B Rev. 1, National Institute of Standards and Technology',
    date: 'Mar. 2020',
    url: 'https://doi.org/10.6028/NIST.SP.800-175Br1',
    accessed: '2026-10-06',
  },
  'google-kyber-blog': { authors: ['D. Adrian', 'D. Benjamin', 'B. Beck', "D. O'Brien"], title: 'A new path for Kyber on the web', container: 'Google Online Security Blog', date: 'Sep. 13, 2024', url: 'https://security.googleblog.com/2024/09/a-new-path-for-kyber-on-web.html', accessed: '2026-10-06' },
  'diffie-hellman-1976': { authors: ['W. Diffie', 'M. E. Hellman'], title: 'New Directions in Cryptography', container: 'IEEE Transactions on Information Theory', note: 'vol. IT-22, no. 6, pp. 644-654', date: 'Nov. 1976', url: 'https://ee.stanford.edu/~hellman/publications/24.pdf', accessed: '2026-10-06' },

  // Other standards and announcements
  'iana-ports': {
    authors: 'Internet Assigned Numbers Authority',
    title: 'Service Name and Transport Protocol Port Number Registry',
    url: 'https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml',
    accessed: CHECKED,
  },
  'itu-x200': {
    authors: 'ITU-T',
    title: 'Information technology - Open Systems Interconnection - Basic Reference Model: The basic model',
    note: 'ITU-T Recommendation X.200, International Telecommunication Union',
    date: 'Jul. 1994',
    url: 'https://www.itu.int/rec/T-REC-X.200-199407-I/en',
    accessed: CHECKED,
  },
  'cabf-baseline-requirements': {
    authors: 'CA/Browser Forum',
    title: 'Baseline Requirements for the Issuance and Management of Publicly-Trusted TLS Server Certificates',
    note: 'Version 2.3.1',
    date: 'Oct. 4, 2026',
    url: 'https://cabforum.org/working-groups/server/baseline-requirements/requirements/',
    accessed: '2026-10-06',
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
  'aws-vpc-route-priority': aws('How route priority works', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/route-tables-priority.html'),
  'aws-vpc-routing-options': aws('Example routing options', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html'),
  'aws-vpc-nacls': aws('Control subnet traffic with network access control lists', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html'),
  'aws-vpc-default-nacl': aws('Default network ACL for a VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/default-network-acl.html'),
  'aws-vpc-custom-nacl': aws('Custom network ACLs for your VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html'),
  'aws-vpc-subnet-route-tables': aws('Subnet route tables', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html'),
  'aws-vpc-create-nacl': aws('Create a network ACL for your VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/create-network-acl.html'),
  'aws-vpc-security-groups': aws('Control traffic to your AWS resources using security groups', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html'),
  'aws-vpc-infrastructure-security': aws('Infrastructure security in Amazon VPC', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html'),
  'aws-vpc-quotas': aws('Amazon VPC quotas', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/amazon-vpc-limits.html'),
  'aws-vpc-nat-gateways': aws('NAT gateways', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html'),
  'aws-vpc-nat-gateway-basics': aws('NAT gateway basics', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-basics.html'),
  'aws-vpc-regional-nat': aws('Regional NAT gateways for automatic multi-AZ expansion', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateways-regional.html'),
  'aws-ec2-create-subnet': aws('CreateSubnet', 'Amazon EC2 API Reference', 'https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_CreateSubnet.html'),
  'aws-vpc-faq': aws('Amazon VPC FAQs', undefined, 'https://aws.amazon.com/vpc/faqs/'),
  'aws-vpc-peering': aws('How VPC peering connections work', 'Amazon VPC Peering Guide', 'https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html'),
  'aws-tgw-vpc-attachments': aws('Amazon VPC attachments in AWS Transit Gateway', 'Amazon VPC Transit Gateways', 'https://docs.aws.amazon.com/vpc/latest/tgw/tgw-vpc-attachments.html'),
  'aws-tgw-how-it-works': aws('How AWS Transit Gateway works', 'Amazon VPC Transit Gateways', 'https://docs.aws.amazon.com/vpc/latest/tgw/how-transit-gateways-work.html'),
  'aws-eks-vpc-cni': aws('Assign IPs to Pods with the Amazon VPC CNI', 'Amazon EKS User Guide', 'https://docs.aws.amazon.com/eks/latest/userguide/managing-vpc-cni.html'),

  'root-servers': { authors: 'Root Server Technical Operations Association', title: 'Root Servers', url: 'https://root-servers.org/', accessed: CHECKED },

  // DNS and Route 53
  'aws-route53-concepts': aws('Amazon Route 53 concepts', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/route-53-concepts.html'),
  'aws-route53-public-zones': aws('Considerations when working with public hosted zones', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zone-public-considerations.html'),
  'aws-route53-private-zones': aws('Working with private hosted zones', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-private.html'),
  'aws-route53-resolver-forwarding': aws('Resolving DNS queries between VPCs and your network', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-overview-DSN-queries-to-vpc.html'),
  'aws-route53-routing-policies': aws('Choosing a routing policy', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html'),
  'aws-route53-resolver': aws('What is Route 53 VPC Resolver?', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html'),
  'aws-route53-resolver-inbound': { ...aws('Forwarding inbound DNS queries to your VPCs', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-forwarding-inbound-queries.html'), accessed: '2026-10-08' },
  rfc4301: { ...rfc(4301, ['S. Kent', 'K. Seo'], 'Security Architecture for the Internet Protocol', 'Dec. 2005'), accessed: '2026-10-08' },
  'aws-vpc-sg-rules': { ...aws('Security group rules', VPC_GUIDE, 'https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html'), accessed: '2026-10-08' },
  'aws-ec2-eni': { ...aws('Elastic network interfaces', 'Amazon EC2 User Guide', 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-eni.html'), accessed: '2026-10-08' },

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
  'aws-s3-website-permissions': aws('Setting permissions for website access', 'Amazon S3 User Guide', 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteAccessPermissionsReqd.html'),
  'aws-shield': aws('AWS Shield', 'AWS WAF, AWS Firewall Manager, and AWS Shield Developer Guide', 'https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html'),

  // Load balancing and WAF
  'aws-nlb-listeners': aws('Listeners for your Network Load Balancers', 'Elastic Load Balancing User Guide for Network Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-listeners.html'),
  'aws-nlb-intro': aws('What is a Network Load Balancer?', 'Elastic Load Balancing User Guide for Network Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html'),
  'aws-gwlb-intro': aws('What is a Gateway Load Balancer?', 'Elastic Load Balancing User Guide for Gateway Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/gateway/introduction.html'),
  'aws-alb-certificates': aws('SSL certificates for your Application Load Balancer', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/https-listener-certificates.html'),
  'aws-nlb-certificates': aws('Server certificates for your Network Load Balancer', 'Elastic Load Balancing User Guide for Network Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/tls-listener-certificates.html'),
  'aws-alb-quotas': aws('Quotas for your Application Load Balancers', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-limits.html'),
  'aws-elb-how-it-works': aws('How Elastic Load Balancing works', 'Elastic Load Balancing User Guide', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html'),
  'aws-alb-listener-rules': aws('Listener rules for your Application Load Balancer', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-rules.html'),
  'aws-alb-rule-conditions': aws('Condition types for listener rules', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/rule-condition-types.html'),
  'aws-alb-rule-actions': aws('Action types for listener rules', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/rule-action-types.html'),
  'aws-alb-target-group-attributes': aws('Edit target group attributes for your Application Load Balancer', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html'),
  'aws-nlb-target-group-attributes': aws('Edit target group attributes for your Network Load Balancer', 'Elastic Load Balancing User Guide for Network Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/network/edit-target-group-attributes.html'),
  'aws-alb-intro': aws('What is an Application Load Balancer?', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html'),
  'aws-alb-target-groups': aws('Target groups for your Application Load Balancers', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html'),
  'aws-alb-header-modification': aws('HTTP header modification for your Application Load Balancer', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/header-modification.html'),
  'aws-alb-mtls': aws('Mutual authentication with TLS in Application Load Balancer', 'Elastic Load Balancing User Guide for Application Load Balancers', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/mutual-authentication.html'),
  'aws-waf-resources': aws('Resources that you can protect with AWS WAF', 'AWS WAF Developer Guide', 'https://docs.aws.amazon.com/waf/latest/developerguide/how-aws-waf-works-resources.html'),

  // Certificates and DNS
  'aws-route53-alias': aws('Choosing between alias and non-alias records', 'Amazon Route 53 Developer Guide', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html'),
  'aws-acm-caa': aws('Certification Authority Authorization (CAA) problems', 'AWS Certificate Manager User Guide', 'https://docs.aws.amazon.com/acm/latest/userguide/troubleshooting-caa.html'),
  'aws-acm-acme': { ...aws('ACME certificate automation', 'AWS Certificate Manager User Guide', 'https://docs.aws.amazon.com/acm/latest/userguide/acm-acme.html'), accessed: '2026-10-06' },
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
  'mozilla-root-store': { authors: ['W. Thayer'], title: 'Why Does Mozilla Maintain Our Own Root Certificate Store?', container: 'Mozilla Security Blog', date: 'Feb. 14, 2019', url: 'https://blog.mozilla.org/security/2019/02/14/why-does-mozilla-maintain-our-own-root-certificate-store/', accessed: CHECKED },
  'letsencrypt-chains': { authors: "Let's Encrypt", title: 'Chains of Trust', url: 'https://letsencrypt.org/certificates/', accessed: '2026-10-06' },
  'chrome-ct-policy': { authors: 'The Chromium Projects', title: 'Chrome Certificate Transparency Policy', url: 'https://googlechrome.github.io/CertificateTransparency/ct_policy.html', accessed: '2026-10-06' },
  'oracle-jsse': { authors: 'Oracle', title: 'Java Secure Socket Extension (JSSE) Reference Guide', container: 'Java SE 21 Security Developer Guide', url: 'https://docs.oracle.com/en/java/javase/21/security/java-secure-socket-extension-jsse-reference-guide.html', accessed: '2026-10-06' },
  'letsencrypt-challenges': { authors: "Let's Encrypt", title: 'Challenge Types', url: 'https://letsencrypt.org/docs/challenge-types/', accessed: CHECKED },
  'caddy-automatic-https': { authors: 'Caddy', title: 'Automatic HTTPS', container: 'Caddy Documentation', url: 'https://caddyserver.com/docs/automatic-https', accessed: CHECKED },
  'mdn-x-forwarded-for': { authors: 'MDN contributors', title: 'X-Forwarded-For header', container: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For', accessed: CHECKED },
  'mdn-proxies': { authors: 'MDN contributors', title: 'Proxy servers and tunneling', container: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Proxy_servers_and_tunneling', accessed: CHECKED },
  'mdn-connect': { authors: 'MDN contributors', title: 'CONNECT request method', container: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/CONNECT', accessed: '2026-10-07' },
  rfc9112: { ...rfc(9112, ['R. Fielding, Ed.', 'M. Nottingham, Ed.', 'J. Reschke, Ed.'], 'HTTP/1.1', 'Jun. 2022'), accessed: '2026-10-07' },
  'curl-http-proxy': { authors: 'D. Stenberg', title: 'HTTP proxy', container: 'Everything curl', url: 'https://everything.curl.dev/usingcurl/proxies/http.html', accessed: '2026-10-07' },
  'openssh-ssh-config': { authors: 'OpenBSD', title: 'ssh_config(5)', container: 'OpenBSD manual pages', url: 'https://man.openbsd.org/ssh_config', accessed: '2026-10-07' },
  'aws-ec2-instance-metadata': { authors: AWS, title: 'Use instance metadata to manage your EC2 instance', container: 'Amazon EC2 User Guide', url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-metadata.html', accessed: '2026-10-07' },
  'aws-ec2-imds-access': { authors: AWS, title: 'Access instance metadata for an EC2 instance', container: 'Amazon EC2 User Guide', url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html', accessed: '2026-10-07' },
  'curl-proxy-env': { authors: 'D. Stenberg', title: 'Proxy environment variables', container: 'Everything curl', url: 'https://everything.curl.dev/usingcurl/proxies/env.html', accessed: CHECKED },
  'mdn-x-forwarded-proto': { authors: 'MDN contributors', title: 'X-Forwarded-Proto header', container: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-Proto', accessed: CHECKED },
  'gitlab-no-proxy': { authors: 'S. Hu', title: 'We need to talk: Can we standardize NO_PROXY?', container: 'GitLab Blog', url: 'https://about.gitlab.com/blog/we-need-to-talk-no-proxy/', accessed: CHECKED },
  'chromium-network-settings': { authors: 'The Chromium Projects', title: 'Network Settings', container: 'Chromium Design Documents', url: 'https://www.chromium.org/developers/design-documents/network-settings/', accessed: CHECKED },
  'python-requests-advanced': { authors: 'K. Reitz and contributors', title: 'Advanced Usage', container: 'Requests Documentation', url: 'https://requests.readthedocs.io/en/latest/user/advanced/', accessed: CHECKED },
  'python-ipaddress': { authors: 'Python Software Foundation', title: 'ipaddress: IPv4/IPv6 manipulation library', container: 'The Python Standard Library', url: 'https://docs.python.org/3/library/ipaddress.html', accessed: CHECKED },
  'node-cli': { authors: 'OpenJS Foundation', title: 'Command-line API', container: 'Node.js Documentation', url: 'https://nodejs.org/api/cli.html', accessed: CHECKED },
  'java-keytool': { authors: 'Oracle', title: 'The keytool Command', container: 'Java SE 21 Tool Specifications', url: 'https://docs.oracle.com/en/java/javase/21/docs/specs/man/keytool.html', accessed: CHECKED },
  'openssl-verify-errors': { authors: 'OpenSSL Project', title: 'X509_STORE_CTX_get_error', container: 'OpenSSL Documentation', url: 'https://docs.openssl.org/master/man3/X509_STORE_CTX_get_error/', accessed: '2026-10-06' },
  'openssl-s-client': { authors: 'OpenSSL Project', title: 'openssl-s_client', container: 'OpenSSL Documentation', url: 'https://docs.openssl.org/master/man1/openssl-s_client/', accessed: CHECKED },

  // Command-line tools on Windows and macOS (PowerShell tabs, Decision 0008)
  'ms-curl-windows': { authors: 'Microsoft', title: 'curl on Windows', container: 'Microsoft Learn', date: 'May 19, 2026', url: 'https://learn.microsoft.com/en-us/windows/curl/', accessed: '2026-10-06' },
  'ms-resolve-dnsname': { authors: 'Microsoft', title: 'Resolve-DnsName', container: 'Windows PowerShell DnsClient Module Reference', url: 'https://learn.microsoft.com/en-us/powershell/module/dnsclient/resolve-dnsname', accessed: '2026-10-06' },
  'ms-clear-dnsclientcache': { authors: 'Microsoft', title: 'Clear-DnsClientCache', container: 'Windows PowerShell DnsClient Module Reference', url: 'https://learn.microsoft.com/en-us/powershell/module/dnsclient/clear-dnsclientcache', accessed: '2026-10-06' },
  'ms-pktmon-syntax': { authors: 'Microsoft', title: 'Pktmon command formatting', container: 'Microsoft Learn: Windows Server', url: 'https://learn.microsoft.com/en-us/windows-server/networking/technologies/pktmon/pktmon-syntax', accessed: '2026-10-06' },
  'ms-pktmon-start': { authors: 'Microsoft', title: 'pktmon start', container: 'Microsoft Learn: Windows Commands', url: 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/pktmon-start', accessed: '2026-10-06' },
  'ms-openssh-overview': { authors: 'Microsoft', title: 'OpenSSH for Windows overview', container: 'Microsoft Learn: Windows Server', url: 'https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh-overview', accessed: '2026-10-06' },
  'ms-about-env-vars': { authors: 'Microsoft', title: 'about_Environment_Variables', container: 'PowerShell 7.5 Documentation', url: 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables', accessed: '2026-10-06' },
  'ms-about-parsing': { authors: 'Microsoft', title: 'about_Parsing', container: 'PowerShell 7.5 Documentation', date: 'Jun. 29, 2026', url: 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing', accessed: '2026-10-06' },
  'git-for-windows-release-notes': { authors: 'Git for Windows', title: 'Git for Windows Release Notes', container: 'git-for-windows/build-extra', date: 'Oct. 5, 2026', url: 'https://github.com/git-for-windows/build-extra/blob/main/ReleaseNotes.md', accessed: '2026-10-06' },
  'apple-dns-cache': { authors: 'Apple', title: 'Reset the DNS cache in OS X', container: 'Apple Support', url: 'https://support.apple.com/en-us/101481', accessed: '2026-10-06' },
  'systemd-resolvectl': { authors: 'systemd project', title: 'resolvectl', container: 'systemd manual pages', url: 'https://www.freedesktop.org/software/systemd/man/latest/resolvectl.html', accessed: '2026-10-06' },
  'ms-new-selfsignedcertificate': { authors: 'Microsoft', title: 'New-SelfSignedCertificate', container: 'Windows PowerShell PKIClient Module Reference', url: 'https://learn.microsoft.com/en-us/powershell/module/pki/new-selfsignedcertificate', accessed: '2026-10-06' },

  // Reaching private resources
  'aws-repost-client-vpn-phz': { ...aws('How do I resolve resource records in my private hosted zone using Client VPN?', 'AWS re:Post Knowledge Center', 'https://repost.aws/knowledge-center/client-vpn-resolve-resource-records'), accessed: '2026-10-08' },
  'aws-vpc-peering-create': { ...aws('Create a VPC peering connection', 'Amazon VPC Peering Guide', 'https://docs.aws.amazon.com/vpc/latest/peering/create-vpc-peering-connection.html'), accessed: '2026-10-07' },
  'aws-vpc-peering-basics': { ...aws('How VPC peering connections work', 'Amazon VPC Peering Guide', 'https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html'), accessed: '2026-10-07' },
  'aws-vpc-peering-sg': { ...aws('Update your security groups to reference peer security groups', 'Amazon VPC Peering Guide', 'https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-security-groups.html'), accessed: '2026-10-07' },
  'aws-vpc-peering-dns': { ...aws('Enable DNS resolution for a VPC peering connection', 'Amazon VPC Peering Guide', 'https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-dns.html'), accessed: '2026-10-07' },
  'aws-tgw-share': { ...aws('Shared transit gateways', 'Amazon VPC Transit Gateways', 'https://docs.aws.amazon.com/vpc/latest/tgw/transit-gateway-share.html'), accessed: '2026-10-07' },
  'aws-tgw-create': { ...aws('Create a transit gateway in AWS Transit Gateway', 'Amazon VPC Transit Gateways', 'https://docs.aws.amazon.com/vpc/latest/tgw/create-tgw.html'), accessed: '2026-10-07' },
  'aws-vpc-pricing': { ...aws('Amazon VPC pricing', undefined, 'https://aws.amazon.com/vpc/pricing/'), accessed: '2026-10-07' },
  'aws-tgw-pricing': { ...aws('AWS Transit Gateway pricing', undefined, 'https://aws.amazon.com/transit-gateway/pricing/'), accessed: '2026-10-07' },
  'aws-privatelink-share': { ...aws('Share your services through AWS PrivateLink', 'AWS PrivateLink', 'https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-share-your-services.html'), accessed: '2026-10-07' },
  'aws-privatelink-concepts': { ...aws('AWS PrivateLink concepts', 'AWS PrivateLink', 'https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html'), accessed: '2026-10-07' },
  'aws-multivpc-privatelink': { ...aws('AWS PrivateLink', 'Building a Scalable and Secure Multi-VPC AWS Network Infrastructure (AWS Whitepaper)', 'https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/aws-privatelink.html'), accessed: '2026-10-07' },
  'aws-nat-gateway-scenarios': { ...aws('NAT gateway use cases', 'Amazon VPC User Guide', 'https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-scenarios.html'), accessed: '2026-10-07' },
  'aws-vpc-peering-routing': { ...aws('Update your route tables for a VPC peering connection', 'Amazon VPC Peering Guide', 'https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-routing.html'), accessed: '2026-10-07' },
  'aws-s2s-vpn-static-dynamic': { ...aws('Static and dynamic routing in AWS Site-to-Site VPN', 'AWS Site-to-Site VPN User Guide', 'https://docs.aws.amazon.com/vpn/latest/s2svpn/vpn-static-dynamic.html'), accessed: '2026-10-07' },
  'aws-dx-what-is': { ...aws('What is Direct Connect?', 'AWS Direct Connect User Guide', 'https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html'), accessed: '2026-10-07' },
  'aws-dx-macsec': { ...aws('MAC Security in Direct Connect', 'AWS Direct Connect User Guide', 'https://docs.aws.amazon.com/directconnect/latest/UserGuide/MACsec.html'), accessed: '2026-10-07' },
  'aws-client-vpn-what-is': { ...aws('What is AWS Client VPN?', 'AWS Client VPN Administrator Guide', 'https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/what-is.html'), accessed: '2026-10-07' },
  'aws-client-vpn-rules': { ...aws('Rules and best practices for using AWS Client VPN', 'AWS Client VPN Administrator Guide', 'https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/what-is-best-practices.html'), accessed: '2026-10-07' },
  'kubectl-run': { authors: 'The Kubernetes Authors', title: 'kubectl run', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/reference/kubectl/generated/kubectl_run/', accessed: '2026-10-07' },
  'kubectl-port-forward': { authors: 'The Kubernetes Authors', title: 'kubectl port-forward', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/reference/kubectl/generated/kubectl_port-forward/', accessed: '2026-10-07' },
  'alpine-socat-dockerfile': { authors: 'alpine-docker', title: 'socat/Dockerfile', container: 'alpine-docker/multi-arch-libs', note: 'GitHub repository', url: 'https://github.com/alpine-docker/multi-arch-libs/blob/master/socat/Dockerfile', accessed: '2026-10-07' },
  'aws-ssm-cli-start-session': { ...aws('start-session', 'AWS CLI Command Reference', 'https://docs.aws.amazon.com/cli/latest/reference/ssm/start-session.html'), accessed: '2026-10-07' },
  'aws-ssm-documents': { ...aws('AWS Systems Manager Documents', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/documents.html'), accessed: '2026-10-07' },
  'aws-ssm-prerequisites': { ...aws('Step 1: Complete Session Manager prerequisites', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-prerequisites.html'), accessed: '2026-10-07' },
  'aws-ssm-instance-permissions': { ...aws('Step 2: Verify or add instance permissions for Session Manager', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-instance-profile.html'), accessed: '2026-10-07' },
  'aws-s2s-vpn-what-is': aws('What is AWS Site-to-Site VPN?', 'AWS Site-to-Site VPN User Guide', 'https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html'),
  'aws-dx-encryption-in-transit': aws('Encryption in AWS Direct Connect', 'AWS Direct Connect User Guide', 'https://docs.aws.amazon.com/directconnect/latest/UserGuide/encryption-in-transit.html'),
  'aws-s2s-vpn-resilience': aws('Resilience in AWS Site-to-Site VPN', 'AWS Site-to-Site VPN User Guide', 'https://docs.aws.amazon.com/vpn/latest/s2svpn/disaster-recovery-resiliency.html'),
  'aws-client-vpn-access': aws('Provide Client VPN users with access to AWS resources', 'AWS re:Post Knowledge Center', 'https://repost.aws/knowledge-center/client-vpn-give-users-resource-access'),
  'aws-client-vpn-auth-rules': aws('AWS Client VPN authorization rules', 'AWS Client VPN Administrator Guide', 'https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/cvpn-working-rules.html'),
  'aws-ssm-session-manager': aws('AWS Systems Manager Session Manager', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html'),
  'aws-ssm-start-session': aws('Start a session', 'AWS Systems Manager User Guide', 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html'),
  'aws-ec2-instance-connect-endpoint': aws('Connect to your instances using a private IP address and EC2 Instance Connect Endpoint', 'Amazon EC2 User Guide', 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-with-ec2-instance-connect-endpoint.html'),
  'openssh-ssh': { authors: 'OpenBSD', title: 'ssh(1)', container: 'OpenBSD manual pages', url: 'https://man.openbsd.org/ssh', accessed: CHECKED },
  'k8s-port-forward': { authors: 'The Kubernetes Authors', title: 'Use Port Forwarding to Access Applications in a Cluster', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/', accessed: CHECKED },
  'k8s-control-plane-comms': { authors: 'The Kubernetes Authors', title: 'Communication between Nodes and the Control Plane', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/concepts/architecture/control-plane-node-communication/', accessed: CHECKED },
  'k8s-network-policies': { authors: 'The Kubernetes Authors', title: 'Network Policies', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/concepts/services-networking/network-policies/', accessed: '2026-10-08' },
  'k8s-rbac-good-practices': { authors: 'The Kubernetes Authors', title: 'Role Based Access Control Good Practices', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/concepts/security/rbac-good-practices/', accessed: '2026-10-08' },
  'k8s-images': { authors: 'The Kubernetes Authors', title: 'Images', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/concepts/containers/images/', accessed: '2026-10-08' },
  'postgresql-libpq-ssl': { authors: 'The PostgreSQL Global Development Group', title: 'SSL Support', container: 'PostgreSQL Documentation', url: 'https://www.postgresql.org/docs/current/libpq-ssl.html', accessed: '2026-10-08' },
  'aws-rds-postgres-ssl': { ...aws('Using SSL with a PostgreSQL DB instance', 'Amazon RDS User Guide', 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html'), accessed: '2026-10-08' },
  'socat-manual': { authors: 'G. Rieger', title: 'socat - Multipurpose relay', container: 'socat documentation', url: 'http://www.dest-unreach.org/socat/doc/socat.html', accessed: CHECKED },

  // Kubernetes object size limits
  'k8s-configmap': { authors: 'The Kubernetes Authors', title: 'ConfigMaps', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/concepts/configuration/configmap/', accessed: '2026-10-09' },
  'k8s-secret': { authors: 'The Kubernetes Authors', title: 'Secrets', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/concepts/configuration/secret/', accessed: '2026-10-09' },
  'etcd-limits': { authors: 'The etcd Authors', title: 'System limits', container: 'etcd v3.5 Documentation', url: 'https://etcd.io/docs/v3.5/dev-guide/limit/', accessed: '2026-10-09' },
  'helm-storage-backends': { authors: 'The Helm Authors', title: 'Storage backends', container: 'Helm Documentation, Advanced Helm Techniques', url: 'https://helm.sh/docs/topics/advanced/', accessed: '2026-10-09' },
  'k8s-components': { authors: 'The Kubernetes Authors', title: 'Kubernetes Components', container: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/concepts/overview/components/', accessed: '2026-10-09' },
  'k8s-validation-size': { authors: 'The Kubernetes Authors', title: 'pkg/apis/core/validation/validation.go (ValidateConfigMap)', container: 'kubernetes/kubernetes', note: 'GitHub repository, commit ef06af9', url: 'https://github.com/kubernetes/kubernetes/blob/ef06af9b9d09e8dc0eb1cc0768b0b542f35549bb/pkg/apis/core/validation/validation.go#L8204-L8232', accessed: '2026-10-09' },
  'k8s-validation-secret-size': { authors: 'The Kubernetes Authors', title: 'pkg/apis/core/validation/validation.go (ValidateSecret)', container: 'kubernetes/kubernetes', note: 'GitHub repository, commit ef06af9', url: 'https://github.com/kubernetes/kubernetes/blob/ef06af9b9d09e8dc0eb1cc0768b0b542f35549bb/pkg/apis/core/validation/validation.go#L8101-L8115', accessed: '2026-10-09' },
  'airlock-configmap-size': { authors: 'Ergon Informatik AG', title: 'ConfigMaps size limit', container: 'Airlock Microgateway 4.7 Documentation', url: 'https://docs.airlock.com/microgateway/4.7/index/1730261073553.html', accessed: '2026-10-09' },
  'helm-intro': { authors: 'The Helm Authors', title: 'Introduction to Helm', container: 'Helm Documentation', url: 'https://helm.sh/docs/intro/introduction/', accessed: '2026-10-09' },
  'helm-using': { authors: 'The Helm Authors', title: 'Using Helm', container: 'Helm Documentation', url: 'https://helm.sh/docs/intro/using_helm/', accessed: '2026-10-09' },
  'helm-source-storage': { authors: 'The Helm Authors', title: 'pkg/storage/storage.go (makeKey)', container: 'helm/helm', note: 'GitHub repository, commit dc56a44', url: 'https://github.com/helm/helm/blob/dc56a44fee5ac036807348bc48653bc93d714953/pkg/storage/storage.go#L339-L341', accessed: '2026-10-09' },
  'helm-source-upgrade': { authors: 'The Helm Authors', title: 'pkg/action/upgrade.go', container: 'helm/helm', note: 'GitHub repository, commit dc56a44', url: 'https://github.com/helm/helm/blob/dc56a44fee5ac036807348bc48653bc93d714953/pkg/action/upgrade.go#L408-L470', accessed: '2026-10-09' },
  'helm-source-encode': { authors: 'The Helm Authors', title: 'pkg/storage/driver/util.go (encodeRelease)', container: 'helm/helm', note: 'GitHub repository, commit dc56a44', url: 'https://github.com/helm/helm/blob/dc56a44fee5ac036807348bc48653bc93d714953/pkg/storage/driver/util.go#L36-L58', accessed: '2026-10-09' },
  'ms-out-string': { authors: 'Microsoft', title: 'Out-String', container: 'PowerShell 7.6 Documentation', url: 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/out-string', accessed: '2026-10-09' },
  'dotnet-getbytecount': { authors: 'Microsoft', title: 'Encoding.GetByteCount Method', container: '.NET API Reference', url: 'https://learn.microsoft.com/en-us/dotnet/api/system.text.encoding.getbytecount', accessed: '2026-10-09' },

  // Philosophy: the Presocratics
  'pt-001': { authors: ['S. West'], title: 'Episode #001 - Transcript', container: 'Philosophize This!', note: 'transcript of "Ionian Pre-Socratic Philosophy"', url: 'https://www.philosophizethis.org/transcript/episode-001-transcript', accessed: PHIL },
  'pt-002': { authors: ['S. West'], title: 'Episode #002 - Transcript', container: 'Philosophize This!', note: 'transcript of "Italian Pre-Socratic Philosophy"', url: 'https://www.philosophizethis.org/transcript/episode-2-transcript', accessed: PHIL },
  'sep-presocratics': sep(['P. Curd'], 'Presocratic Philosophy', 'rev. Jun. 22, 2020', 'presocratics'),
  'sep-heraclitus': sep(['D. W. Graham'], 'Heraclitus', 'rev. Dec. 8, 2023', 'heraclitus'),
  'sep-pythagoras': sep(['C. Huffman'], 'Pythagoras', 'rev. Feb. 5, 2024', 'pythagoras'),
  'sep-parmenides': sep(['J. Palmer'], 'Parmenides', 'rev. Mar. 4, 2025', 'parmenides'),
  'sep-zeno': sep(['J. Palmer'], 'Zeno of Elea', 'rev. May 12, 2025', 'zeno-elea'),
  'sep-empedocles': sep(['K. S. Kingsley', 'R. Parry'], 'Empedocles', 'rev. Sep. 25, 2024', 'empedocles'),
  'sep-democritus': sep(['S. Berryman'], 'Democritus', 'rev. Jan. 7, 2023', 'democritus'),
  'sep-socrates': sep(['D. Nails', 'S. S. Monoson'], 'Socrates', 'rev. May 26, 2022', 'socrates'),
  'sep-leucippus': sep(['S. Berryman'], 'Leucippus', 'rev. Jan. 9, 2023', 'leucippus'),
  'sep-about': { authors: 'Metaphysics Research Lab, Stanford University', title: 'About the Stanford Encyclopedia of Philosophy', container: 'The Stanford Encyclopedia of Philosophy', url: 'https://plato.stanford.edu/about.html', accessed: '2026-10-09' },
  'sep-editorial': { authors: 'Metaphysics Research Lab, Stanford University', title: 'Editorial Information', container: 'The Stanford Encyclopedia of Philosophy', url: 'https://plato.stanford.edu/info.html', accessed: '2026-10-09' },
  'iep-about': { authors: 'Internet Encyclopedia of Philosophy', title: 'About the IEP', container: IEP, url: 'https://iep.utm.edu/about/', accessed: '2026-10-09' },
  'iep-thales': { authors: ["P. O'Grady"], title: 'Thales of Miletus', container: IEP, url: 'https://iep.utm.edu/thales/', accessed: PHIL },
  'iep-anaximander': { authors: ['D. L. Couprie'], title: 'Anaximander', container: IEP, url: 'https://iep.utm.edu/anaximan/', accessed: PHIL },
  'iep-anaximenes': { authors: ['D. W. Graham'], title: 'Anaximenes', container: IEP, url: 'https://iep.utm.edu/anaximen/', accessed: PHIL },
  // Code review
  rfc7231: { ...rfc(7231, ['R. Fielding, Ed.', 'J. Reschke, Ed.'], 'Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content', 'Jun. 2014'), accessed: '2026-10-08' },
  'git-worktree': { authors: 'Git Project', title: 'git-worktree: manage multiple working trees', container: 'Git documentation', url: 'https://git-scm.com/docs/git-worktree', accessed: '2026-10-08' },
  'google-review-standard': { authors: 'Google', title: 'The Standard of Code Review', container: 'Google Engineering Practices Documentation', url: 'https://google.github.io/eng-practices/review/reviewer/standard.html', accessed: '2026-10-08' },
  'google-review-looking-for': { authors: 'Google', title: 'What to look for in a code review', container: 'Google Engineering Practices Documentation', url: 'https://google.github.io/eng-practices/review/reviewer/looking-for.html', accessed: '2026-10-08' },
  'coderabbit-pr-validation': { authors: 'CodeRabbit', title: 'PR validation using linked issues', container: 'CodeRabbit Documentation', url: 'https://docs.coderabbit.ai/issues/pr-validation', accessed: '2026-10-08' },
  'qodo-ticketing': { authors: 'Qodo', title: 'Use ticket context in code reviews', container: 'Qodo Documentation', url: 'https://docs.qodo.ai/integrations/ticketing-integrations', accessed: '2026-10-08' },
  'conventional-comments': { authors: 'Conventional Comments', title: 'Conventional Comments', url: 'https://conventionalcomments.io', accessed: '2026-10-08' },
  'braz-2022': { authors: ['L. Braz', 'C. Aeberhard', 'G. Çalikli', 'A. Bacchelli'], title: 'Less is More: Supporting Developers in Vulnerability Detection during Code Review', container: 'Proc. 44th Int. Conf. Software Engineering (ICSE)', date: 'May 2022', url: 'https://arxiv.org/abs/2202.04586', accessed: '2026-10-08' },
  'bacchelli-bird-2013': { authors: ['A. Bacchelli', 'C. Bird'], title: 'Expectations, Outcomes, and Challenges of Modern Code Review', container: 'Proc. 35th Int. Conf. Software Engineering (ICSE)', date: 'May 2013', url: 'https://www.microsoft.com/en-us/research/publication/expectations-outcomes-and-challenges-of-modern-code-review/', accessed: '2026-10-08' },
  'owasp-file-upload': { authors: 'OWASP', title: 'File Upload Cheat Sheet', container: 'OWASP Cheat Sheet Series', url: 'https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html', accessed: '2026-10-08' },
  'owasp-llm01': { authors: 'OWASP', title: 'LLM01:2025 Prompt Injection', container: 'OWASP Top 10 for LLM Applications', url: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/', accessed: '2026-10-08' },
  'github-codeowners': { authors: 'GitHub', title: 'About code owners', container: 'GitHub Docs', url: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners', accessed: '2026-10-09' },
  'sre-book-intro': { authors: ['B. Beyer', 'C. Jones', 'J. Petoff', 'N. R. Murphy'], title: 'Introduction', container: 'Site Reliability Engineering: How Google Runs Production Systems', note: "O'Reilly Media", date: '2016', url: 'https://sre.google/sre-book/introduction/', accessed: '2026-10-09' },
  'sre-book-launches': { authors: ['B. Beyer', 'C. Jones', 'J. Petoff', 'N. R. Murphy'], title: 'Reliable Product Launches at Scale', container: 'Site Reliability Engineering: How Google Runs Production Systems', note: "O'Reilly Media", date: '2016', url: 'https://sre.google/sre-book/reliable-product-launches/', accessed: '2026-10-09' },
  'aws-builders-retries': { authors: 'M. Brooker', title: 'Timeouts, retries, and backoff with jitter', container: "The Amazon Builders' Library", url: 'https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter', accessed: '2026-10-09' },
  'aws-builders-rollback': { authors: 'S. Pokkunuri', title: 'Ensuring rollback safety during deployments', container: "The Amazon Builders' Library", url: 'https://builder.aws.com/content/3F04j2yRAAMBuPSPs50xwXZqg01/ensuring-rollback-safety-during-deployments', accessed: '2026-10-09' },
  'nginx-client-max-body-size': { authors: 'F5, Inc.', title: 'Module ngx_http_core_module: client_max_body_size', container: 'nginx documentation', url: 'https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size', accessed: '2026-10-09' },
  'terraform-plan': { authors: 'HashiCorp', title: 'terraform plan command reference', container: 'Terraform CLI Documentation', url: 'https://developer.hashicorp.com/terraform/cli/commands/plan', accessed: '2026-10-09' },
  'terraform-lifecycle': { authors: 'HashiCorp', title: 'lifecycle block reference', container: 'Terraform Language Documentation', url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle', accessed: '2026-10-09' },
  'cdk-deploy': { ...aws('cdk deploy', 'AWS Cloud Development Kit (AWS CDK) v2 Developer Guide', 'https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-deploy.html'), accessed: '2026-10-09' },
  'helm-template': { authors: 'The Helm Authors', title: 'helm template', container: 'Helm Documentation', url: 'https://helm.sh/docs/helm/helm_template/', accessed: '2026-10-09' },
  'aws-iam-best-practices': { ...aws('Security best practices in IAM', 'AWS Identity and Access Management User Guide', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html'), accessed: '2026-10-09' },
  'aws-access-analyzer-checks': { ...aws('Validate policies with IAM Access Analyzer custom policy checks', 'AWS Identity and Access Management User Guide', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-custom-policy-checks.html'), accessed: '2026-10-09' },
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
