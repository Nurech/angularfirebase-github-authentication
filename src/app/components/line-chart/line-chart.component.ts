import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../shared/services/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { User } from '../../shared/services/user';

@Component({
  selector: 'app-line-chart',
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.scss']
})
export class LineChartComponent implements OnInit {

  destroy$: Subject<void> = new Subject();
  users: User[] = [];
  chartOption: any;
  chartData: Data[] = [];

  constructor(private authService: AuthService) { }

  ngOnInit(): void {
    this.authService.allUsers.pipe(takeUntil(this.destroy$)).subscribe((snapshot) => {
      this.users = snapshot.docs.map((doc: { data: () => any; }) => doc.data());
      this.chartData = [];
      const formatYmd = (date: string | any[]) => date.slice(0, 10);
      for (let user of this.users) {
        let day = this.chartData.find(data => data.name === formatYmd(user.insertTime));
        if (day) {
          day.value[1] += 1;
        } else {
          const val = Object.assign({}, {name: formatYmd(user.insertTime), value: [formatYmd(user.insertTime), 1]});
          this.chartData.push(<Data>val);
        }
      }
      this.setOptions();
    });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
  }

  setOptions() {
    this.chartOption = {
      grid: {
        top: '4%',
        bottom: '20%'
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        splitLine: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        splitLine: {
          show: false
        },
        minInterval: 1
      },
      series: [
        {
          type: 'bar',
          data: this.chartData,
          roundCap: true,
          itemStyle: {
            borderRadius: [50, 50, 0, 0], // Specify the border radius
            borderType: 'solid',
            color: '#1a1a1a',
            borderColor: '#73c0de',
            shadowColor: '#5470c6',
            shadowBlur: 2
          }
        }
      ]
    };
  }

}

export interface Data {
  name: string;
  value: any;
}
