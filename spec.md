# Summary
Web application for managing auction items, bidders and winning bids.

# Technology Stack
+ Postgresql in Docker Container
+ Node.js, Angular in Docker container

# Database Tables
## Events
| column | type | nullable | notes |
| -- | -- | -- | -- |
| event_id | int | no | GENERATED ALWAYS AS IDENTITY PRIMARY KEY |
| event_locator | varchar(8) | no | uppercase alpha hash of event_id | 
| event_desc | varchar(100) | no | -- |
| event_date | DATE | no | -- |
| event_tax_id | varchar(16) | yes | -- |

## Bidders
| column | type | nullable | notes |
| -- | -- | -- | -- |
| bidder_id | int | no | GENERATED ALWAYS AS IDENTITY PRIMARY KEY |
| event_id | int | no| -- |
| bidder_num | int | yes | sequential within event |
| bidder_first_name | varchar(100) | no | -- |
| bidder_last_name | varchar(100) | no | -- |
| bidder_email | varchar(100) | yes | valid email format |
| bidder_credit_card_token | varchar(100) | yes | -- |

+ constraint fk_event foreign key (event_id) references events (event_id)

## Items
| column | type | nullable | notes |
| -- | -- | -- | --|
| item_id | int | no | GENERATED ALWAYS AS IDENTITY PRIMARY KEY |
| event_id | int | no | -- |
| item_type | varchar(20) | no | [Live \| Not Live] |
| item_desc | varchar(100) | no | -- |
| item_notes | varchar(100) | yes | -- |

+ constraint fk_event foreign key (event_id) references events (event_id)

## Winning Bid
| column | type | nullable | notes |
| -- | -- | -- | -- |
| winning_bid_id | int | no | GENERATED ALWAYS AS IDENTITY PRIMARY KEY |
| event_id | int | no | -- |
| bidder_id | int | no | -- |
| item_id | int | no | -- |
| winning_bid | numeric (10,2) | no | -- |

+ constraint fk_event foreign key (event_id) references events (event_id)
+ constraint fk_bidder foreign key (bidder_id) references events (bidder_id)
+ constraint fk_item foreign key (item_id) references events (item_id)
