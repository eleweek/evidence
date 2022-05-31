# Rentals Summary

This analyses the rentals

## Rentals By Day

```rentals_by_day
select
date_trunc('day', rental_date) as day, 
count(*) as total_rentals 
from rental 
group by 1
order by 1 desc
```

### Summary
The most recent day of data was logged on <Value data={data.rentals_by_day} fmt=date/> and the number of rentals was <Value data={data.rentals_by_day} column="total_rentals"/>.

### Daily Chart

<LineChart 
    data={data.rentals_by_day} 
    x=day 
    y=total_rentals
/>

## Rentals by customer

```rentals_by_customer
select r.customer_id as customer_id,
c.first_name || ' ' || c.last_name as customer_name, 
count(r.*) as total_rentals
from rental r inner join customer c on r.customer_id = c.customer_id
group by 1, 2         
order by 3 desc
limit 10;
```
## Top 10 Customers

{#each data.rentals_by_customer as customer_rentals}

{customer_rentals.customer_name}: <Value value={customer_rentals.total_rentals}/>

{/each}

<DataTable data={[{col1:'A', col2: 100 }, {col1: 'B', col2: 200}]} />

### Rentals by customer via Query
<DataTable query='rentals_by_customer' />
### Rentals by customer via data
<DataTable data={data.rentals_by_customer} />


### Rentals by date via Query
<DataTable query='rentals_by_day' />
### Rentals by date via date
<DataTable data={data.rentals_by_day} />

Meta Data
<Value value={JSON.stringify(data.evidencemeta, 2, null)} />


<br/>

